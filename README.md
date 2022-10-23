# Dots

The purpose of this project is to elucidate the details of interacting with
Substrate- and FRAME-based blockchains via front-end JavaScript and
[WebAssembly (Wasm)](https://webassembly.org/). The code in this repository is
for educational and demonstrational purposes only - it is not intended for
production. This project demonstrates the following capabilities:

- [SCALE](https://docs.substrate.io/reference/scale-codec/) encoding and
  decoding
- Parsing
  [FRAME metadata](https://docs.substrate.io/build/application-development/#metadata-system)
- Account (i.e.
  [public/private key](https://docs.substrate.io/fundamentals/accounts-addresses-keys/#public-and-private-keys))
  generation or recovery
- WebSocket interaction with the
  [Substrate JSON-RPC](https://docs.substrate.io/build/application-development/#rpc-apis)
  server
- [Signed extrinsic](https://docs.substrate.io/reference/transaction-format/)
  construction and submission

Those who are familiar with the above concepts may wish to skip ahead to the
[Usage](#usage) section.

## Background

[Substrate](https://substrate.io/) is a [Rust](https://www.rust-lang.org/)
framework for building blockchains;
[FRAME](https://docs.substrate.io/fundamentals/runtime-development/#frame) is
Substrate's framework for building blockchain _runtimes_. A "runtime" is the
component of a blockchain system that represents end-user, application
capabilities. Blockchains that are built with Substrate and FRAME are
self-describing systems that expose
[metadata](https://docs.substrate.io/build/application-development/#metadata-system),
which enables the dynamic, programmatic creation of interfaces that allow users
to interact with the blockchain runtime.

## Project Components

The following sections give a brief overview of the components of this project.

### SCALE Codec

SCALE is Substrate's lightweight and efficient codec (i.e. data serialization
algorithm). The SCALE encoding omits contextual information in pursuit of
efficiency, which means that in order to decode SCALE data, it's necessary to
independently posses a type registry that defines the structures/schemas of the
objects in the data that is to be decoded. Further
[details of the SCALE codec](doc/scale-codec.md) are outlined in a separate
document. Although it may have been possible to reuse existing Rust code and
compile it to Wasm, fighting the Rust type system proved too challenging for an
initial implementation - this is potentially an opportunity to improve this
project. For now, this project uses a [simple JavaScript SCALE](lib/scale.js)
implementation.

### FRAME Metadata

The metadata exposed by FRAME runtimes consists of three components: 1) a type
registry to enable the SCALE-encoding and -decoding of messages to and from the
runtime, 2) a list that describes the data that must be included with
[signed extrinsics](#signed-extrinsics), and 3) an exhaustive description of the
runtime's public interface. Since Substrate and FRAME are Rust-based frameworks,
the metadata that is exposed by FRAME runtimes is defined as a Rust `struct`, in
particular the
[`frame_metadata::v14::RuntimeMetadataV14`](https://docs.rs/frame-metadata/latest/frame_metadata/v14/struct.RuntimeMetadataV14.html)
type has been used by FRAME since around the end of 2021. When a user requests
the metadata from a FRAME-based runtime, the runtime returns a hexadecimal
string that represents the SCALE-encoding of its
`frame_metadata::v14::RuntimeMetadataV14` instance. Although it would be
possible to decode the hex string and parse the metadata in JavaScript (as in
[this older code](https://github.com/danforbes/decode-substrate-metadata/blob/master/index.js)
that does so for version 11 of FRAME metadata), doing so in Rust and making the
resulting code available as Wasm has two primary benefits: 1) it relies on
existing, unit- and battle-tested libraries that are provided by the maintainers
of Substrate, 2) it allows for reliable, efficient transformation of the
metadata into a structure that is better suited for front-end/client-side use.
The Rust code that decodes and transforms the metadata can be found in
[rs/metadata/src/lib.rs](rs/metadata/src/lib.rs).
[Further details](doc/frame-metadata.md) about the
`frame_metadata::v14::RuntimeMetadataV14` format and the transformations that
are applied to it are documented in a separate file.

### Accounts

Like the decoding and transformation of metadata, most of this project's account
capabilities are implemented in Rust and made available to the front-end as
Wasm. The code, which is located in the
[rs/account/src/lib.rs](rs/account/src/lib.rs) file, was more or less copied
directly from
[Polkadot-JS](https://github.com/polkadot-js/wasm/tree/v6.3.1/packages/wasm-crypto/src/rs)
and is fairly self-explanatory. This project supports importing an existing,
known account from its 32-byte
[sr25519](https://wiki.polkadot.network/docs/learn-cryptography#keypairs-and-signing)
private seed, or generating a new
[BIP39](https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki) seed
phrase and using that to derive an sr25519 keypair. An sr25519 account can be
used to sign a message, and a 32-byte sr25519 public key and an
[Ss58 network identifier](https://github.com/paritytech/ss58-registry/) can be
used to derive an
[Ss58 address](https://wiki.polkadot.network/docs/learn-account-advanced#address-format)
for that account.

### JSON-RPC

Substrate uses a [JSON-RPC](https://en.wikipedia.org/wiki/JSON-RPC) server as
its primary mechanism for interacting with end-users. This project defines a
JavaScript class named `Context` as an abstraction on top of a
[WebSocket](https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API)
connection to a Substrate node's JSON-RPC server. Substrate implements a
specification called
[PSP-6](https://github.com/w3f/PSPs/blob/master/PSPs/drafts/psp-6.md) in order
to define its JSON-RPC interface; this project relies on a small subset of the
endpoints defined by this specification. The `Context` class, which can be found
in the [lib/context.js](lib/context.js) file, makes use of the following PSP-6
endpoints:

- [`state_subscribeRuntimeVersion`](https://github.com/w3f/PSPs/blob/master/PSPs/drafts/psp-6.md#11113-state_subscriberuntimeversion-pubsub)
  is used to watch the node for
  [runtime upgrades](https://docs.substrate.io/build/upgrade-the-runtime/)
- [`state_getMetadata`](https://github.com/w3f/PSPs/blob/master/PSPs/drafts/psp-6.md#1119-state_getmetadata)
  is used to retrieve the runtime's [metadata](#metadata), which will only
  change when the runtime version changes by way of a runtime upgrade
- The following endpoints are used to track various properties of the node
  itself (as opposed to the runtime); these properties can be updated on-demand
  by using the `update` method of the `Context` class
  - [`system_name`](https://github.com/w3f/PSPs/blob/master/PSPs/drafts/psp-6.md#152-system_name)
  - [`system_version`](https://github.com/w3f/PSPs/blob/master/PSPs/drafts/psp-6.md#153-system_version)
  - [`system_chain`](https://github.com/w3f/PSPs/blob/master/PSPs/drafts/psp-6.md#154-system_chain)
  - [`system_properties`](https://github.com/w3f/PSPs/blob/master/PSPs/drafts/psp-6.md#156-system_properties)
  - [`system_health`](https://github.com/w3f/PSPs/blob/master/PSPs/drafts/psp-6.md#157-system_health)
- [`state_getStorage`](https://github.com/w3f/PSPs/blob/master/PSPs/drafts/psp-6.md#1116-state_getstorage)
  for querying
  [runtime storage](https://docs.substrate.io/build/runtime-storage/) items
- [`author_submitAndWatchExtrinsic`](https://github.com/w3f/PSPs/blob/master/PSPs/drafts/psp-6.md#189-author_submitandwatchextrinsic-pubsub)
  for submitting and tracking [signed extrinsics](#signed-extrinsics)
- [`system_accountNextIndex`](https://github.com/w3f/PSPs/blob/master/PSPs/drafts/psp-6.md#1516-system_accountnextindex)
  is used to retrieve the
  [nonce](https://en.wikipedia.org/wiki/Cryptographic_nonce) for an account
  before submitting an extrinsic that is signed by that account

### Signed Extrinsics

The term "[extrinsic](https://docs.substrate.io/reference/glossary/#extrinsic)"
is native to Substrate and is used to refer to any external data that is
included in a block of a blockchain. The most straightforward usage of this term
applies to
"[signed extrinsics](https://docs.substrate.io/reference/transaction-format/)",
which are colloquially referred to as "transactions". Signed extrinsics allow
blockchain end-users to interact with the blockchain runtime; as the name
implies, requests of this type must be signed by the private key that is
associated with a blockchain [account](#accounts), which allows the blockchain
network to debit that user's account in order to pay the
[fees](https://docs.substrate.io/build/tx-weights-fees/) associated with that
request. Other types of extrinsics, like
[unsigned extrinsics](https://docs.substrate.io/fundamentals/transaction-types/#unsigned-transactions)
or
[inherents](https://docs.substrate.io/fundamentals/transaction-types/#inherent-transactions),
are out of the scope of this project at this time. Extrinsic encoding is
implemented in the `submitExtrinsic` method of the
[`Context` class](lib/context.js). [More details](doc/extrinsic-encoding.md)
about the encoding of signed extrinsics are documented in a separate file.

## Usage

This project includes a simple browser front-end that is built with standard
[Web Components](https://developer.mozilla.org/en-US/docs/Web/Web_Components).
The front-end uses the metadata from a Substrate- and FRAME-based blockchain to
enumerate the modules ("pallets") that inform the blockchain runtime. Pallets
may expose [storage items](docs/frame-metadata.md#storage-items) or
[dispatchable calls](docs/frame-metadata.md#dispatchable-calls), and the
front-end can be used to query storage items and submit dispatchable calls in
the form of signed extrinsics.

### Requirements

Other than a browser and an HTTP server, the only requirement for building and
using this project is [`wasm-pack`](https://rustwasm.github.io/docs/wasm-pack/)
and its associated dependencies for building the Wasm libraries. First,
[install Rust](https://www.rust-lang.org/tools/install), then
[install `wasm-pack`](https://rustwasm.github.io/wasm-pack/installer/). This
project includes a `package.json` file that provides a command for launching a
simple HTTP server, which requires [Node.js](https://nodejs.org/en/).

### Installation

To build the Wasm libraries and their bindings, and install them in the expected
directory (`lib/wasm`), execute the `build:wasm` NPM script:

```
npm run build:wasm
```

### Web UI

Launch the web UI by executing the `start` NPM script:

```
npm start
```
