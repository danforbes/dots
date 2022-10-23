# SCALE Codec

SCALE, which is an acronym for "simple, concatenated,
little-[endian](https://en.wikipedia.org/wiki/Endianness)", is Substrate's
lightweight and efficient codec (i.e. data serialization algorithm). Like most
things Substrate-related, the
[reference implementation](https://docs.rs/parity-scale-codec/latest/parity_scale_codec/index.html)
of SCALE is written in Rust; moreover, it's productive to realize that
[SCALE's type system](https://docs.rs/scale-info/latest/scale_info/index.html)
is tightly coupled with that of Rust, which is reflected in SCALE's special
support for
[Variant](https://docs.rs/scale-info/latest/scale_info/struct.TypeDefVariant.html)
types, for instance.

The
[SCALE type system](https://docs.rs/scale-info/latest/scale_info/enum.TypeDef.html)
is outlined below.

## Primitive Types

SCALE defines the following
[primitive types](https://docs.rs/scale-info/latest/scale_info/enum.TypeDefPrimitive.html):

- **8- to 256-bit signed- and unsigned-integers** (e.g. `U8` for an unsigned
  8-bit integer, `I32` for a signed 32-bit integer). Scale integer values are
  represented in little-endian form. Note that the `U8` type is ubiquitous since
  it is used to represent an arbitrary byte of data, as in an element of hash or
  signature, which are represented as arrays or lists of bytes (i.e. `U8`s).
- **Boolean values** (i.e. `true` or `false`) are encoded using the least
  significant bit of a single byte, i.e. `0x01` for `true` and `0x00` for
  `false`.
- **Alphanumeric characters and character strings** are encoded as UTF-8 byte
  arrays.

## Compact Numbers

SCALE's compact numbers are used to efficiently represent unsigned numeric
values up to 2<sup>536</sup>. The first (least significant) two bits of a
compact number are interpreted as a flag that is used to indicate the possible
size of the value that is defined by the following bits; this flag has four
permutations, which are described below:

- `0b00` - single-byte mode: This mode is valid _only_ for values from 0-63. The
  upper six bits represent the little-endian encoding of the value.
- `0b01` - two-byte mode: Valid _only_ for values from 64-16,383. The upper six
  bits and the following byte represent the little-endian encoding of the value.
- `0b10` - four-byte mode: Valid _only_ for values from 16,384-1,073,741,823.
  The upper six bits and the following three bytes represent the little-endian
  encoding of the value.
- `0b11` - variable-byte mode: Valid _only_ for values from
  1,073,741,824-2<sup>536</sup>-1. The upper six bits encode the number of bytes
  used to encode the value, plus 4. As in the other modes, the value is
  little-endian encoded. The final (most significant) byte must be non-zero.

## Composites (Objects)

## Tuples

## Fixed-Length Arrays

## Sequences (Lists)

## Bitsequences

## Variants (Enums)
