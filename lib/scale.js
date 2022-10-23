"use strict";

import { PrimitiveScaleType } from "/lib/wasm/metadata/metadata.js";

/**
 * @typedef { import("/lib/wasm/metadata/metadata").Types } Types
 *
 * @param {Array<u8>} bytes
 * @param {u32} id
 * @param {Types} types
 * @returns
 */
export function decode(bytes, id, types) {
  const type = types.get(id);
  switch (PrimitiveScaleType[type.type]) {
    case PrimitiveScaleType.Boolean: {
      return { offset: 1, value: bytes[0] == 0b01 };
    }
    case PrimitiveScaleType.U8: {
      return {
        offset: 1,
        value: new DataView(new Uint8Array(bytes).buffer).getUint8(0, true),
      };
    }
    case PrimitiveScaleType.U16: {
      return {
        offset: 2,
        value: new DataView(new Uint8Array(bytes).buffer).getUint16(0, true),
      };
    }
    case PrimitiveScaleType.U32: {
      return {
        offset: 4,
        value: new DataView(new Uint8Array(bytes).buffer).getUint32(0, true),
      };
    }
    case PrimitiveScaleType.U64: {
      return {
        offset: 8,
        value: new DataView(new Uint8Array(bytes).buffer).getBigUint64(0, true),
      };
    }
    case PrimitiveScaleType.U128: {
      console.warn("Returning U64 for unsupported U128 value");
      return {
        offset: 16,
        value: new DataView(new Uint8Array(bytes).buffer).getBigUint64(0, true),
      };
    }
    case PrimitiveScaleType.U256: {
      console.warn("Returning U64 for unsupported U256 value");
      return {
        offset: 32,
        value: new DataView(new Uint8Array(bytes).buffer).getBigUint64(0, true),
      };
    }
    case PrimitiveScaleType.I8: {
      return {
        offset: 1,
        value: new DataView(new Uint8Array(bytes).buffer).getInt8(0, true),
      };
    }
    case PrimitiveScaleType.I16: {
      return {
        offset: 2,
        value: new DataView(new Uint8Array(bytes).buffer).getInt16(0, true),
      };
    }
    case PrimitiveScaleType.I32: {
      return {
        offset: 4,
        value: new DataView(new Uint8Array(bytes).buffer).getInt32(0, true),
      };
    }
    case PrimitiveScaleType.I64: {
      return {
        offset: 1,
        value: new DataView(new Uint8Array(bytes).buffer).getBigInt64(0, true),
      };
    }
    case PrimitiveScaleType.I128: {
      console.warn("Returning I64 for unsupported I128 value");
      return {
        offset: 16,
        value: new DataView(new Uint8Array(bytes).buffer).getBigInt64(0, true),
      };
    }
    case PrimitiveScaleType.I256: {
      console.warn("Returning I64 for unsupported I256 value");
      return {
        offset: 32,
        value: new DataView(new Uint8Array(bytes).buffer).getBigInt64(0, true),
      };
    }
    case PrimitiveScaleType.Compact: {
      return decodeCompact(bytes);
    }
    case PrimitiveScaleType.String: {
      const len = decodeCompact(bytes);
      return {
        offset: len.offset + len.value,
        value: String.fromCharCode(...bytes.slice(len.offset, len.value + 1)),
      };
    }
    case PrimitiveScaleType.Enum: {
      const idx = new DataView(new Uint8Array(bytes).buffer).getUint8(0, true);
      const variant = type.variants.find((v) => v.index === idx);
      const name = `${type.name}::${variant.name}`;

      let offset = 1;
      if (!variant.fields?.length) {
        return { offset, value: name };
      }

      const fields = [];
      for (const field of variant.fields) {
        const fieldVal = decode(bytes.slice(offset), field.field, types);
        fields.push(fieldVal.value);
        offset += fieldVal.offset;
      }

      const value = { name, fields };
      return { offset, value };
    }
    case PrimitiveScaleType.Option: {
      if (!bytes[0]) {
        return { offset: 1, value: null };
      }

      const val = decode(bytes.slice(1), type.store, types);
      return { offset: 1 + val?.offset, value: val?.value };
    }
    case PrimitiveScaleType.Result: {
      let inner;
      if (!bytes[0]) {
        inner = decode(bytes.slice(1), type.fields[0].field, types);
      } else {
        inner = decode(bytes.slice(1), type.fields[1].field, types);
      }

      return { offset: inner.offset + 1, value: inner.value };
    }
    case PrimitiveScaleType.Tuple: {
      let offset = 0;
      let value = [];
      for (const field of type.fields) {
        const item = decode(bytes.slice(offset), field.field, types);
        offset += item.offset;
        value.push(item.value);
      }

      return { offset, value };
    }
    case PrimitiveScaleType.List: {
      let offset = 0;
      let len = type.length;
      if (!len) {
        let length = decodeCompact(bytes);
        offset += length.offset;
        len = length.value;
      }

      const value = [];
      for (let idx = 0; idx < len; ++idx) {
        const item = decode(bytes.slice(offset), type.store, types);
        offset += item.offset;
        value.push(item.value);
      }

      const isByteArray = types.get(type.store).type === "U8";
      return { offset, value: isByteArray ? toHexString(value) : value };
    }
    case PrimitiveScaleType.Struct: {
      let offset = 0;
      const value = {};
      for (const field of type.fields) {
        const item = decode(bytes.slice(offset), field.field, types);
        if (!item) {
          break;
        }

        value[field.name] = item.value;
        offset += item.offset;
      }

      return { offset, value };
    }
  }
}

export function encodeU8(val) {
  const data = new DataView(new ArrayBuffer(1));
  data.setUint8(0, val);
  return [...new Uint8Array(data.buffer)];
}

export function encode(val, id, types) {
  const type = types.get(id);
  switch (PrimitiveScaleType[type.type]) {
    case PrimitiveScaleType.Boolean: {
      if (val) {
        return [0b01];
      }

      return [0b00];
    }
    case PrimitiveScaleType.U8: {
      return encodeU8(val);
    }
    case PrimitiveScaleType.U16: {
      const data = new DataView(new ArrayBuffer(2));
      data.setUint16(0, val, true);
      return [...new Uint8Array(data.buffer)];
    }
    case PrimitiveScaleType.U32: {
      const data = new DataView(new ArrayBuffer(4));
      data.setUint32(0, val, true);
      return [...new Uint8Array(data.buffer)];
    }
    case PrimitiveScaleType.U64: {
      const data = new DataView(new ArrayBuffer(8));
      data.setBigUint64(0, val, true);
      return [...new Uint8Array(data.buffer)];
    }
    case PrimitiveScaleType.I8: {
      const data = new DataView(new ArrayBuffer(1));
      data.setInt8(0, val);
      return [...new Uint8Array(data.buffer)];
    }
    case PrimitiveScaleType.I16: {
      const data = new DataView(new ArrayBuffer(2));
      data.setInt16(0, val, true);
      return [...new Uint8Array(data.buffer)];
    }
    case PrimitiveScaleType.I32: {
      const data = new DataView(new ArrayBuffer(4));
      data.setInt32(0, val, true);
      return [...new Uint8Array(data.buffer)];
    }
    case PrimitiveScaleType.I64: {
      const data = new DataView(new ArrayBuffer(4));
      data.setBigInt64(0, val, true);
      return [...new Uint8Array(data.buffer)];
    }
    case PrimitiveScaleType.Compact: {
      return encodeCompact(val);
    }
    case PrimitiveScaleType.String: {
      console.log(val, type, types);
      return;
    }
    case PrimitiveScaleType.Enum: {
      if (typeof val.index !== "number") {
        console.warn(
          `Cannot encode enum ${type.name} from ${val} (no numeric "index" property)`
        );
        return;
      }

      const variant = type.variants.find((v) => v.index === val.index);
      if (!variant) {
        console.warn(
          `Could not encode variant #${parsed + 1} for ${type.name} with ${
            type.variants.length
          } variants`
        );
        return;
      }

      const data = new DataView(new ArrayBuffer(1));
      data.setUint8(0, val.index);

      if (!variant.fields || !variant.fields.length) {
        return [...new Uint8Array(data.buffer)];
      }

      if (variant.fields.length !== val.fields?.length) {
        console.warn(`Fields for ${type.name}::${variant.name} not provided`);
      }

      let fields = [];
      for (let idx = 0; idx < val.fields.length; ++idx) {
        fields = [
          ...fields,
          ...encode(val.fields[idx], variant.fields[idx].field, types),
        ];
      }

      return [...new Uint8Array(data.buffer), ...fields];
    }
    case PrimitiveScaleType.Option: {
      if (!val) {
        return [0b00];
      }

      return [0b01, ...encode(val, type.store, types)];
    }
    case PrimitiveScaleType.Result: {
      if (val.ok) {
        return [0b00, encode(val.ok, type.fields[1], types)];
      }

      return [0b01, encode(val.err, type.fields[0], types)];
    }
    case PrimitiveScaleType.Tuple: {
      let value = [];
      for (let idx = 0; (idx = val.length); ++idx) {
        value.push(encode(val[idx], type.fields.get(idx), types));
      }

      return value;
    }
    case PrimitiveScaleType.List: {
      if (types.get(type.store).type === "U8" && isHexString(val)) {
        let value = val
          .slice(2)
          .match(/.{1,2}/g)
          .map((byte) => encodeU8(parseInt(byte, 16))[0]);

        if (!type.length) {
          value = [...encodeCompact(value.length), ...value];
        }

        return value;
      }

      return;
    }
    case PrimitiveScaleType.Struct: {
      console.log(val, type, types);
      return;
    }
  }
}

function decodeCompact(bytes) {
  const view = new DataView(new Uint8Array(bytes).buffer);
  const raw = view.getUint8(0, true);
  const flag = raw & 0b11;
  if (!flag) {
    return { offset: 1, value: raw >> 2 };
  } else if (flag === 0b01) {
    return {
      offset: 2,
      value: new DataView(new Uint8Array(bytes).buffer).getUint16(0, true) >> 2,
    };
  } else if (flag === 0b10) {
    return {
      offset: 4,
      value: new DataView(new Uint8Array(bytes).buffer).getUint32(0, true) >> 2,
    };
  }
}

export function encodeCompact(val) {
  if (val < 64) {
    const data = new DataView(new ArrayBuffer(1));
    data.setUint8(0, val << 2);
    return [...new Uint8Array(data.buffer)];
  } else if (val < 2 ** 14) {
    const data = new DataView(new ArrayBuffer(2));
    data.setUint16(0, (val << 2) | 0b01, true);
    return [...new Uint8Array(data.buffer)];
  } else if (val < 2 ** 30) {
    const data = new DataView(new ArrayBuffer(4));
    data.setUint32(0, (val << 2) | 0b10, true);
    return [...new Uint8Array(data.buffer)];
  }
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

function isHexString(obj) {
  return typeof obj === "string" && /^0x[0-9a-f]+$/.exec(obj);
}
