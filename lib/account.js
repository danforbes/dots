"use strict";

import initWasm, {
  addressFromPublicKey,
  keypairFromSecret,
  phraseSize,
  newPhrase,
  secretFromPhrase,
  sign,
} from "/lib/wasm/account/account.js";

export default class Account {
  static #alice =
    "0xe5be9a5092b81bca64be81d212e7f2f9eba183bb7a90954f7b76361f6edb5c0a";

  /**
   * @type { String }
   */
  #phrase;

  /**
   *  @type { Uint8Array }
   */
  #secret;

  /**
   * @type { Uint8Array }
   */
  #keypair;

  /**
   * Mapping of network IDs to SS58 addresses for this account
   */
  #addresses = {};

  /**
   * Number of words that can be in a BIP phrase
   */
  static #allowedWords = {
    12: phraseSize.Words12,
    15: phraseSize.Words15,
    18: phraseSize.Words18,
    21: phraseSize.Words21,
    24: phraseSize.Words24,
  };

  /**
   * Generate a new Account backed by a BIP phrase that has the specified length in words
   * @param {number} numWords
   * @returns a new Account backed by a BIP phrase that has the specified length in words
   */
  static async generate(numWords = 12) {
    if (Account.#allowedWords[numWords] !== undefined) {
      numWords = Account.#allowedWords[numWords];
    } else {
      console.warn(
        `The words argument must be 12, 15, 18, 21, or 24; got ${words}. Reverting to a 12-word phrase.`
      );

      numWords = phraseSize.Words12;
    }

    const account = new Account();
    await initWasm();
    account.#phrase = newPhrase(numWords);
    account.#secret = secretFromPhrase(account.#phrase, "");
    account.#keypair = keypairFromSecret(account.#secret);
    return account;
  }

  /**
   * Generate a new account backed by the specified hex secret
   * @param {string} secret
   * @returns a new account backed by the specified hex secret
   */
  static async fromSecret(secret = Account.#alice) {
    if (!secret.match(/0x[0-9A-Fa-f]{64}/)) {
      console.warn(
        `Invalid secret: ${secret}; reverting to development secret ${
          this.#secret
        }`
      );
      secret = Account.#alice;
    }

    const account = new Account();
    account.#secret = Uint8Array.from(
      secret
        .slice(2)
        .match(/.{1,2}/g)
        .map((byte) => parseInt(byte, 16))
    );
    await initWasm();
    account.#keypair = keypairFromSecret(account.#secret);
    return account;
  }

  get phrase() {
    return this.#phrase;
  }

  get secret() {
    if (!this.#secret) {
      return undefined;
    }

    return "0x" + Array.from(this.#secret).map(byteToHex).join("");
  }

  get keypair() {
    if (!this.#keypair) {
      return undefined;
    }

    return {
      private: this.#keypair.slice(0, 64),
      public: this.#keypair.slice(64),
    };
  }

  get privateKey() {
    if (!this.keypair) {
      return undefined;
    }

    return "0x" + Array.from(this.keypair.private).map(byteToHex).join("");
  }

  get publicKey() {
    if (!this.keypair) {
      return undefined;
    }

    return "0x" + Array.from(this.keypair.public).map(byteToHex).join("");
  }

  /**
   * Get the SS58 for this account and the given network format
   * @param {number} network
   * @returns the SS58 for this account and the given network format
   */
  address(network) {
    if (this.#addresses[network]) {
      return this.#addresses[network];
    }

    if (!this.#keypair) {
      return undefined;
    }

    this.#addresses[network] = addressFromPublicKey(
      this.#keypair.slice(64),
      network
    );
    return this.#addresses[network];
  }

  sign(val) {
    if (!this.#keypair) {
      return;
    }

    return sign(this.keypair.public, this.keypair.private, val);
  }
}

function byteToHex(byte) {
  return ("0" + byte.toString(16)).slice(-2);
}
