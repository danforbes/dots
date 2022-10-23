use base58::ToBase58;
use bip39::{Language, Mnemonic, MnemonicType};
use blake2_rfc::blake2b::Blake2b;
use hmac::Hmac;
use pbkdf2::pbkdf2;
use schnorrkel::{ExpansionMode, MiniSecretKey, PublicKey, SecretKey};
use sha2::Sha512;
use ss58_registry::Ss58AddressFormat;
use wasm_bindgen::prelude::*;

#[wasm_bindgen(js_name = phraseSize)]
pub enum PhraseSize {
    Words12,
    Words15,
    Words18,
    Words21,
    Words24,
}

/// Create a new bip39 phrase
///
/// size: number of words in the phrase
///
/// Returns a new bip39 phrase
#[wasm_bindgen(js_name = newPhrase)]
pub fn new_phrase(size: PhraseSize) -> String {
    match size {
        PhraseSize::Words12 => {
            Mnemonic::new(MnemonicType::Words12, Language::English).into_phrase()
        }
        PhraseSize::Words15 => {
            Mnemonic::new(MnemonicType::Words15, Language::English).into_phrase()
        }
        PhraseSize::Words18 => {
            Mnemonic::new(MnemonicType::Words18, Language::English).into_phrase()
        }
        PhraseSize::Words21 => {
            Mnemonic::new(MnemonicType::Words21, Language::English).into_phrase()
        }
        PhraseSize::Words24 => {
            Mnemonic::new(MnemonicType::Words24, Language::English).into_phrase()
        }
    }
}

/// Create a secret from a bip39 phrase
///
/// phrase: mnemonic phrase
/// password: password for the secret
///
/// Returns the 32-byte secret via entropy
///
/// ref: https://github.com/polkadot-js/wasm/blob/v6.3.1/packages/wasm-crypto/src/rs/bip39.rs#L39:L60
#[wasm_bindgen(js_name = secretFromPhrase)]
pub fn secret_from_phrase(phrase: &str, password: &str) -> Vec<u8> {
    match Mnemonic::validate(phrase, Language::English) {
        Ok(noop) => noop,
        _ => panic!("Invalid phrase"),
    }

    match Mnemonic::from_phrase(phrase, Language::English) {
        Ok(m) => {
            let mut res = [0u8; 64];
            let mut seed = vec![];

            seed.extend_from_slice(b"mnemonic");
            seed.extend_from_slice(password.as_bytes());

            pbkdf2::<Hmac<Sha512>>(m.entropy(), &seed, 2048, &mut res);
            res[..32].to_vec()
        }
        _ => panic!("Invalid phrase"),
    }
}

/// Create an sr25519 keypair from a secret
///
/// secret: 32-byte secret
///
/// Returns a 96-byte vector that is the result of appending the 32-byte public key to the end of the
/// 64-byte private key
///
/// ref: https://github.com/polkadot-js/wasm/blob/v6.3.1/packages/wasm-crypto/src/rs/sr25519.rs#L81:L96
#[wasm_bindgen(js_name = keypairFromSecret)]
pub fn keypair_from_secret(secret: &[u8]) -> Vec<u8> {
    match MiniSecretKey::from_bytes(secret) {
        Ok(s) => s
            .expand_to_keypair(ExpansionMode::Ed25519)
            .to_half_ed25519_bytes()
            .to_vec(),
        _ => panic!("Invalid secret"),
    }
}

/// Create an Ss58 address from a public key and an Ss58 format
///
/// public_key: 32-byte public key
/// format: Ss58 format
///
/// Returns the Ss58 address for the public key and format
///
/// ref: https://github.com/paritytech/substrate/blob/monthly-2022-09/primitives/core/src/crypto.rs#L317:L338
#[wasm_bindgen(js_name = addressFromPublicKey)]
pub fn address_from_public_key(public_key: &[u8], format: u8) -> String {
    let network = match Ss58AddressFormat::try_from(format) {
        Ok(network) => network,
        _ => panic!("Unsupported network"),
    };

    let prefix = u16::from(network);
    let mut bytes = match prefix {
        0..=63 => vec![prefix as u8],
        64..=16_383 => {
            let first = ((prefix & 0b0000_0000_1111_1100) as u8) >> 2;
            let second = ((prefix >> 8) as u8) | ((prefix & 0b0000_0000_0000_0011) as u8) << 6;

            vec![first | 0b01000000, second]
        }
        _ => panic!("Unsupported network"),
    };

    bytes.extend(public_key);

    let blake2b = {
        let mut context = Blake2b::new(64);
        context.update(b"SS58PRE");
        context.update(&bytes);

        context.finalize()
    };

    bytes.extend(&blake2b.as_bytes()[0..2]);

    bytes.to_base58()
}

/// Sign a message
///
/// * pubkey: 32-byte public key
/// * privkey: 64-byte private key
/// * message: message to be signed
///
/// * Returns a 64-byte signature
/// ref: https://github.com/polkadot-js/wasm/blob/v6.3.1/packages/wasm-crypto/src/rs/sr25519.rs#L113-#L132
#[wasm_bindgen]
pub fn sign(pubkey: &[u8], privkey: &[u8], message: &[u8]) -> Vec<u8> {
    match (
        SecretKey::from_ed25519_bytes(privkey),
        PublicKey::from_bytes(pubkey),
    ) {
        (Ok(s), Ok(k)) => s.sign_simple(b"substrate", message, &k).to_bytes().to_vec(),
        _ => panic!("Invalid key"),
    }
}
