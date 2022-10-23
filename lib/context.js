"use strict";

import Metadata from "/lib/metadata.js";
import Utilities from "/lib/utilities.js";
import { decode, encode, encodeCompact, encodeU8 } from "/lib/scale.js";

export default class Context {
  static #defaultUrl = "wss://westend-rpc.polkadot.io";

  #url;
  #websocket;
  #connected = false;

  #updated;
  #utilities;

  #genesisHash;

  system;
  #system = {
    name: undefined,
    version: undefined,
    chain: undefined,
    properties: undefined,
    health: undefined,
  };

  #runtimeVersion;
  #metadata;
  #canSign;

  #requests = {};

  #subscriptions = {};

  #account;

  /**
   * @param {import("/lib/account").default} account
   */
  set account(account) {
    this.#account = account;
  }

  static async new(wsUrl = Context.#defaultUrl) {
    const context = new Context(wsUrl);
    context.#utilities = await Utilities.new();
    await context.update();
    context.#genesisHash = (
      await context.#getResponse("chain_getBlockHash", 0)
    )?.result;
    return context;
  }

  constructor(wsUrl = Context.#defaultUrl) {
    Utilities.new().then((utilities) => (this.#utilities = utilities));
    this.#url = wsUrl;
    this.#websocket = new WebSocket(this.#url);
    this.#websocket.onopen = () => {
      this.#connected = true;
      this.#sendRequest({
        id: "version-subscription",
        method: "state_subscribeRuntimeVersion",
      });
    };

    this.#websocket.onmessage = async (event) => {
      const data = JSON.parse(event.data);
      if (this.#system.hasOwnProperty(data.id)) {
        ++this.#updated;
        this.#system[data.id] = data.result;
        return;
      }

      if (data.method === "state_runtimeVersion") {
        const result = data.params.result;
        this.#runtimeVersion = Object.freeze(result);
        const metadataHex = localStorage.getItem(
          `${result.implName}-${result.specVersion}`
        );
        if (metadataHex) {
          this.#setMetadata(metadataHex);
        } else {
          this.#sendRequest({
            id: "metadata",
            method: "state_getMetadata",
          });
        }

        return;
      }

      if (data.id === "version-subscription") {
        return;
      }

      if (data.id === "metadata") {
        this.#setMetadata(data.result);
        for (const key in localStorage) {
          if (key.match(new RegExp(`^${this.#runtimeVersion.implName}-`))) {
            localStorage.removeItem(key);
          }
        }

        localStorage.setItem(
          `${this.#runtimeVersion.implName}-${
            this.#runtimeVersion.specVersion
          }`,
          data.result
        );
        return;
      }

      if (this.#requests[data.id]?.pending) {
        this.#requests[data.id] = data;
        return;
      }

      const subscriptionId = data?.params?.subscription;
      if (subscriptionId) {
        this.#subscriptions[subscriptionId]?.callback(data.params.result);
        return;
      }

      console.warn(data);
    };
  }

  async utilities() {
    while (!this.#utilities) {
      await sleep(100);
    }

    return this.#utilities;
  }

  async update() {
    while (!this.#connected) {
      await sleep(100);
    }

    this.#updated = 0;
    for (const property in this.#system) {
      this.#sendRequest({ id: property, method: `system_${property}` });
    }

    const keys = Object.keys(this.#system).length;
    const startTime = performance.now();
    while (this.#updated < keys) {
      await sleep(100);
    }

    const endTime = performance.now();
    console.log(
      `Updating dots context took ${endTime - startTime} milliseconds`
    );

    this.system = Object.freeze(this.#system);
    return this.system;
  }

  async metadata() {
    if (this.#metadata) {
      return this.#metadata;
    }

    const startTime = performance.now();
    while (!this.#metadata) {
      await sleep(100);
    }

    const endTime = performance.now();
    console.log(
      `Fetching FRAME metadata took ${endTime - startTime} milliseconds`
    );

    return this.#metadata;
  }

  async runtimeVersion() {
    if (this.#runtimeVersion) {
      return this.#runtimeVersion;
    }

    const startTime = performance.now();
    while (!this.#runtimeVersion) {
      await sleep(100);
    }

    const endTime = performance.now();
    console.log(
      `Fetching FRAME runtime version took ${endTime - startTime} milliseconds`
    );

    return this.#runtimeVersion;
  }

  // ref: https://www.shawntabrizi.com/substrate/querying-substrate-storage-via-rpc/
  async queryStorage(palletName, storageItem) {
    const utilities = await this.utilities();
    const key = toHexString(utilities.xx128(palletName)).concat(
      toHexString(utilities.xx128(storageItem.name)).slice(2)
    );

    return await this.#storageQuery(key, storageItem.type);
  }

  // ref: https://www.shawntabrizi.com/substrate/transparent-keys-in-substrate/
  async queryStorageMap(palletName, storageItem, key) {
    key = encode(key, storageItem.map.key, this.#metadata.types);

    let hashedKey;
    const utilities = await this.utilities();
    const hasher = storageItem.map.hashers[0];
    switch (hasher) {
      case "Blake2_128Concat": {
        const hashed = utilities.blake2b128(key);
        const concat = toHexString(key).slice(2);
        hashedKey = toHexString(hashed).slice(2).concat(concat);
        break;
      }
      case "Twox64Concat": {
        const hashed = utilities.xx64(key);
        const concat = toHexString(key).slice(2);
        hashedKey = toHexString(hashed).slice(2).concat(concat);
        break;
      }
      default: {
        console.warn(`Unknown storage map hasher ${hasher}`);
        return;
      }
    }

    const storageKey = toHexString(utilities.xx128(palletName)).concat(
      toHexString(utilities.xx128(storageItem.name)).slice(2).concat(hashedKey)
    );

    return this.#storageQuery(storageKey, storageItem.map.value);
  }

  // ref: https://substrate.stackexchange.com/a/638/12
  // ref: https://github.com/paritytech/polkadot-interaction-examples-rs/blob/main/src/bin/05_transfer_balance.rs
  // ref: https://wiki.polkadot.network/docs/build-transaction-construction#transaction-format
  async submitExtrinsic(palletIdx, call, params, callback) {
    if (!this.#canSign) {
      console.warn("Cannot submit extrinsic (unsupported signed extensions)");
      return;
    }

    if (params.length < call.fields.length) {
      console.warn(
        `Cannot submit extrinsic (expected ${call.fields.length} params, got ${params.length})`
      );
      return;
    }

    const metadata = await this.metadata();
    const types = metadata.types;
    const version = await this.runtimeVersion();
    const utilities = await this.utilities();

    let extra = [];
    let additional = [];
    for (const extension of this.#metadata.signing.extensions) {
      switch (extension.name) {
        case "CheckSpecVersion": {
          additional = [
            ...additional,
            ...encode(version.specVersion, extension.additional, types),
          ];
          break;
        }
        case "CheckTxVersion": {
          additional = [
            ...additional,
            ...encode(version.transactionVersion, extension.additional, types),
          ];
          break;
        }
        case "CheckGenesis": {
          additional = [
            ...additional,
            ...encode(this.#genesisHash, extension.additional, types),
          ];
          break;
        }
        case "CheckMortality": {
          // all transaction are immortal
          extra = [...extra, ...encode({ index: 0 }, extension.type, types)];
          additional = [
            ...additional,
            ...encode(this.#genesisHash, extension.additional, types),
          ];
          break;
        }
        case "CheckNonce": {
          const nonce = (
            await this.#getResponse(
              "system_accountNextIndex",
              this.#account.address(this.#system.properties.ss58Format)
            )
          )?.result;
          extra = [...extra, ...encode(nonce, extension.type, types)];
          break;
        }
        case "ChargeTransactionPayment": {
          extra = [...extra, ...encode(0, extension.type, types)];
          break;
        }
      }
    }

    let args = [];
    for (let idx = 0; idx < call.fields.length; ++idx) {
      const encodedArg = encode(params[idx], call.fields[idx].field, types);
      if (!encodedArg) {
        const type = types.get(call.fields[idx].field);
        const message = `Could not encode ${type.name} from ${params[idx]}`;
        const error = { message };
        console.warn(message);
        return { error };
      }

      args = [...args, ...encodedArg];
    }

    const encodedCall = [
      ...encodeU8(palletIdx),
      ...encodeU8(call.index),
      ...args,
    ];

    let signed;
    const unsigned = [...encodedCall, ...extra, ...additional];
    if (unsigned.length > 256) {
      signed = this.#account.sign(utilities.blake2b(unsigned, 256));
    } else {
      signed = this.#account.sign(unsigned);
    }

    const signature = [
      // MultiAddress index (public key)
      0b00,
      ...this.#account.keypair.public,
      // MultiSignature index (sr25519)
      0b01,
      ...signed,
      ...extra,
    ];
    const extrinsic = [4 | 0b10000000, ...signature, ...encodedCall];
    const extrinsicLen = encodeCompact(extrinsic.length);
    const hex = toHexString([...extrinsicLen, ...extrinsic]);
    const response = await this.#getResponse(
      "author_submitAndWatchExtrinsic",
      hex
    );

    if (response.error) {
      console.warn("Submit extrinsic error", response.error);
      return response;
    }

    const id = response.result;
    const unsubscribe = () => delete this.#subscriptions[id];
    this.#subscriptions[id] = {
      callback,
      unsubscribe,
    };

    return { unsubscribe };
  }

  #setMetadata(hex) {
    if (!/^0x[0-9a-f]+$/.exec(hex)) {
      console.warn(`Metadata hex is not valid`);
      return;
    }

    Metadata.fromHex(
      hex
        .slice(2)
        .match(/.{1,2}/g)
        .map((byte) => parseInt(byte, 16))
    ).then((metadata) => {
      this.#canSign = true;
      for (const extension of metadata.signing.extensions) {
        switch (extension.name) {
          case "CheckSpecVersion":
          case "CheckTxVersion":
          case "CheckGenesis":
          case "CheckMortality":
          case "CheckNonce":
          case "ChargeTransactionPayment":
            break;
          default: {
            console.warn(`Unsupported signed extension: ${extension.name}`);
            this.#canSign = false;
          }
        }
      }

      this.#metadata = Object.freeze(metadata);
    });
  }

  #sendRequest(request) {
    this.#websocket.send(JSON.stringify({ ...request, jsonrpc: "2.0" }));
  }

  async #getResponse(method, ...params) {
    const id = Math.random().toString(16).slice(2);
    this.#requests[id] = { pending: true };
    this.#sendRequest({ id, method, params });

    while (this.#requests[id].pending) {
      await sleep(100);
    }

    const val = this.#requests[id];
    delete this.#requests[id];
    return val;
  }

  async #storageQuery(key, type) {
    const item = await this.#getResponse("state_getStorage", key);
    if (!item.result) {
      console.warn(item);
      return;
    }

    return decode(
      fromHexString(item.result.slice(2)),
      type,
      this.#metadata.types
    )?.value;
  }
}

async function sleep(ms) {
  await new Promise((r) => setTimeout(r, ms));
}

function toHexString(bytes) {
  return (
    "0x" +
    bytes.reduce(
      (output, elem) => output + ("0" + elem.toString(16)).slice(-2),
      ""
    )
  );
}

function fromHexString(bytes) {
  return Uint8Array.from(
    bytes.match(/.{1,2}/g).map((byte) => parseInt(byte, 16))
  );
}
