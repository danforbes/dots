# FRAME Metadata

The metadata exposed by FRAME runtimes consists of three components: 1) a type
registry to enable the SCALE-encoding and -decoding of messages to and from the
runtime, 2) a list that describes the data that must be included with
[signed extrinsics](extrinsic-encoding.md), and 3) an exhaustive description of
the runtime's public interface. FRAME runtimes are composed of modules that are
colloquially referred to as "pallets". The public interface of a FRAME runtime
is defined by components of these pallets: [constants](#constants),
[storage items](#storage-items), [events](#events), [errors](#errors), and
[dispatchable calls](#dispatchable-calls). In addition to describing the
components of FRAME metadata, this document also describes the
[transformations](#metadata-transformations) that are applied to FRAME metadata
in order to make it more digestible by front-end JavaScript

## Type Registry

The metadata's type registry provides the contextual information necessary for
[SCALE](../README.md#scale-codec)-encoding and -decoding the types defined and
used by the runtime. In particular, the type registry is a serialized instance
of a Rust
[`PortableRegistry` struct](https://docs.rs/scale-info/latest/scale_info/struct.PortableRegistry.html).
The `PortableRegistry` maps numeric type IDs to the
[`Type`s](https://docs.rs/scale-info/latest/scale_info/struct.Type.html) to
which those IDs refer. Each `Type` is informed by a number of properties,
including an inner
[`TypeDef`](https://docs.rs/scale-info/latest/scale_info/enum.TypeDef.html) that
provides the information that is necessary for SCALE-encoding and -decoding the
type. Many of the [transformations](#metadata-transformations) that are applied
to the metadata relate to the type registry.

## Pallets

"Pallet" is a colloquial term that refers to a FRAME runtime module - these
modules define interfaces that allow pallets to interact with one another, as
well as with end-users. This document focuses on the end-user capabilities,
which are divided into five categories: constants, storage items, events,
errors, and dispatchable calls.

### Constants

[Constants](https://docs.rs/frame-metadata/latest/frame_metadata/v14/struct.PalletConstantMetadata.html)
are storage items that are static between
[runtime upgrades](https://docs.substrate.io/build/upgrade-the-runtime/) - their
values can be read, but not mutated by end-user interactions. Because constant
values are static within a given runtime version, their SCALE-encoded values are
present in FRAME runtime metadata. A good example of a constant value is the
[`maxSignatories` value](https://polkadot.js.org/docs/substrate/constants#maxsignatories-u16)
of the
[Multisig pallet](https://paritytech.github.io/substrate/master/pallet_multisig/) -
this value is used by the maintainers of the Multisig pallet in order to
establish a
[reasonable bound](https://docs.substrate.io/build/runtime-storage/#create-bounds)
on the amount of storage that may be consumed by the end-user interfaces that
the Multisig pallet exposes.

### Storage Items

[Storage items](https://docs.rs/frame-metadata/latest/frame_metadata/v14/struct.StorageEntryMetadata.html)
are similar to constants in the sense that both represent data that is
guaranteed by the blockchain network's consensus mechanism. Unlike constants,
however, storage items' values may change between runtime upgrades. Typically
changes to storage items occur as a result of a user request submitted via a
[dispatchable call](#dispatchable-calls) - for instance, the storage item that
represents the
[balance for an account](https://docs.rs/pallet-balances/latest/pallet_balances/pallet/struct.Pallet.html#method.free_balance)
will be increased if that account is the recipient of a
[balance transfer](https://docs.rs/pallet-balances/latest/pallet_balances/pallet/struct.Pallet.html#method.transfer).

### Events

Requests to blockchain runtimes are asynchronous. When a user submits a
[dispatchable call](#dispatchable-calls), they do not receive a response;
instead, they can subscribe to a notification stream that will alert them of
changes to the call's status, such as the call being included in a block. In
order for a runtime interface to report the result of user's request, it can
deposit one or more
"[events](https://docs.rs/frame-metadata/latest/frame_metadata/v14/struct.PalletEventMetadata.html)"
into the block in which the call was included. Runtime events may contain one or
more fields (e.g. a balance
[transfer event](https://docs.rs/pallet-balances/latest/pallet_balances/pallet/enum.Event.html#variant.Transfer)
has three fields that represent the account that initiated the transfer, the
account that is the recipient of the transfer, and the amount of the transfer).
In general, events are used to report that the runtime was able to
**successfully** process a request.

### Errors

Errors are very similar to runtime events, but (as their name suggests) they are
used to report that the runtime was **unable** to process a request. For
instance, if the runtime receives a balance transfer request from an account
with a balance that is insufficient to fulfill that request, it will emit an
[`InsufficientBalance` error](https://docs.rs/pallet-balances/latest/pallet_balances/pallet/enum.Error.html#variant.InsufficientBalance).

### Dispatchable Calls

The concept of dispatchable calls is native to Substrate. Generally speaking,
dispatchable calls are the interfaces that allow blockchain users to request
updates to runtime storage. Technically speaking, a dispatchable call is a
public Rust function with the following features:

- The function is in a module that is decorated with the
  [`pallet` attribute (macro)](https://docs.rs/frame-support/latest/frame_support/attr.pallet.html),
  and is defined within the
  [`call` attribute](https://docs.rs/frame-support/latest/frame_support/attr.pallet.html#call-palletcall-mandatory)
  for that module.
- The function is decorated with a `weight` attribute, which is used by the
  runtime to calculate
  [transaction fees](https://docs.substrate.io/build/tx-weights-fees/).
- The function's first parameter must be named `origin` and must be of
  [type `OriginFor`](https://docs.rs/frame-system/latest/frame_system/pallet_prelude/type.OriginFor.html).
  This parameter is used by the runtime to determine the account that is making
  the request and that will pay the transaction fees.
- The function's return type is
  [`DispatchResultWithPostInfo`](https://docs.rs/frame-support/latest/frame_support/dispatch/type.DispatchResultWithPostInfo.html).

## Signed Extensions

## Metadata Transformations
