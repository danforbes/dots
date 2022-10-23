"use strict";

import initWasm, {
  blake2b128,
  xx64,
  xx128,
} from "/lib/wasm/utilities/utilities.js";

export default class Utilities {
  #ready = false;
  #encoder = new TextEncoder();
  static async new() {
    await initWasm();
    const utils = new Utilities();
    utils.#ready = true;
    return utils;
  }

  constructor() {
    initWasm().then(() => (this.#ready = true));
  }

  blake2b128(data, size) {
    if (!this.#ready) {
      console.warn("Utilities Wasm not initialized");
      return;
    }

    if (typeof data === "string") {
      data = this.#encoder.encode(data);
    }

    return blake2b128(data, size);
  }

  xx64(data) {
    if (!this.#ready) {
      console.warn("Utilities Wasm not initialized");
      return;
    }

    if (typeof data === "string") {
      data = this.#encoder.encode(data);
    }

    return xx64(data);
  }

  xx128(data) {
    if (!this.#ready) {
      console.warn("Utilities Wasm not initialized");
      return;
    }

    if (typeof data === "string") {
      data = this.#encoder.encode(data);
    }

    return xx128(data);
  }
}
