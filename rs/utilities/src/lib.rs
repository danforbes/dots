use sp_core::hashing::{blake2_128, twox_128, twox_64};
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn blake2b128(data: &[u8]) -> Vec<u8> {
    blake2_128(data).to_vec()
}

#[wasm_bindgen]
pub fn xx64(data: &[u8]) -> Vec<u8> {
    twox_64(data).to_vec()
}

#[wasm_bindgen]
pub fn xx128(data: &[u8]) -> Vec<u8> {
    twox_128(data).to_vec()
}
