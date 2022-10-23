"use strict";

import initWasm, { metadataFromHex } from "/lib/wasm/metadata/metadata.js";

export default class Metadata {
  pallets;
  types;
  signing;

  static async fromHex(hex) {
    const startTime = performance.now();

    await initWasm();
    const meta = metadataFromHex(hex);
    const endTime = performance.now();

    const metadata = new Metadata();
    metadata.pallets = Object.freeze(meta.pallets);
    metadata.types = Object.freeze(meta.types);
    metadata.signing = Object.freeze(meta.signing);

    console.log(
      `Parsing FRAME metadata in Wasm took ${endTime - startTime} milliseconds`
    );

    return metadata;
  }
}
