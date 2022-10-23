use std::collections::BTreeMap;

use frame_metadata::{
    ExtrinsicMetadata, PalletCallMetadata, PalletConstantMetadata, PalletErrorMetadata,
    PalletEventMetadata, PalletMetadata, PalletStorageMetadata, RuntimeMetadataV14,
    SignedExtensionMetadata, StorageEntryType, StorageHasher,
};

use parity_scale_codec::Decode;

use scale_info::{
    form::PortableForm, PortableRegistry, TypeDef, TypeDefArray, TypeDefBitSequence,
    TypeDefCompact, TypeDefComposite, TypeDefPrimitive, TypeDefSequence, TypeDefTuple,
    TypeDefVariant,
};

use serde::Serialize;
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
#[derive(Serialize)]
pub enum PrimitiveScaleType {
    Boolean,
    String,
    U8,
    U16,
    U32,
    U64,
    U128,
    U256,
    I8,
    I16,
    I32,
    I64,
    I128,
    I256,
    Compact,
    Enum,
    Option,
    Result,
    Tuple,
    List,
    Struct,
}

#[wasm_bindgen]
#[derive(Serialize)]
struct Field {
    name: Option<String>,
    field: u32,
}

impl From<u32> for Field {
    fn from(raw: u32) -> Self {
        Field {
            name: None,
            field: raw,
        }
    }
}

impl From<&scale_info::Field<PortableForm>> for Field {
    fn from(raw: &scale_info::Field<PortableForm>) -> Self {
        Field {
            name: raw.name().map(String::to_string),
            field: raw.ty().id(),
        }
    }
}

#[wasm_bindgen]
#[derive(Serialize)]
struct Variant {
    index: u8,
    name: String,
    fields: Option<Vec<Field>>,
}

impl From<&scale_info::Variant<PortableForm>> for Variant {
    fn from(raw: &scale_info::Variant<PortableForm>) -> Self {
        let field_arr = raw.fields();
        let fields = match field_arr.len() == 0 {
            true => None,
            false => Some(field_arr.into_iter().map(|f| f.into()).collect()),
        };
        Variant {
            index: raw.index(),
            name: raw.name().to_string(),
            fields,
        }
    }
}

#[wasm_bindgen]
#[derive(Serialize)]
struct ScaleType {
    #[serde(rename = "type")]
    ty: PrimitiveScaleType,
    variants: Option<Vec<Variant>>,
    store: Option<u32>,
    length: Option<u32>,
    fields: Option<Vec<Field>>,
    order: Option<u32>,
    name: Option<String>,
}

impl From<&TypeDefPrimitive> for ScaleType {
    fn from(raw: &TypeDefPrimitive) -> Self {
        let ty = match raw {
            TypeDefPrimitive::Bool => PrimitiveScaleType::Boolean,
            TypeDefPrimitive::Char | TypeDefPrimitive::Str => PrimitiveScaleType::String,
            TypeDefPrimitive::U8 => PrimitiveScaleType::U8,
            TypeDefPrimitive::U16 => PrimitiveScaleType::U16,
            TypeDefPrimitive::U32 => PrimitiveScaleType::U32,
            TypeDefPrimitive::U64 => PrimitiveScaleType::U64,
            TypeDefPrimitive::U128 => PrimitiveScaleType::U128,
            TypeDefPrimitive::U256 => PrimitiveScaleType::U256,
            TypeDefPrimitive::I8 => PrimitiveScaleType::I8,
            TypeDefPrimitive::I16 => PrimitiveScaleType::I16,
            TypeDefPrimitive::I32 => PrimitiveScaleType::I32,
            TypeDefPrimitive::I64 => PrimitiveScaleType::I64,
            TypeDefPrimitive::I128 => PrimitiveScaleType::I128,
            TypeDefPrimitive::I256 => PrimitiveScaleType::I256,
        };

        ScaleType {
            ty,
            variants: None,
            store: None,
            length: None,
            fields: None,
            order: None,
            name: None,
        }
    }
}

impl From<&TypeDefCompact<PortableForm>> for ScaleType {
    fn from(raw: &TypeDefCompact<PortableForm>) -> Self {
        ScaleType {
            ty: PrimitiveScaleType::Compact,
            variants: None,
            store: Some(raw.type_param().id()),
            length: None,
            fields: None,
            order: None,
            name: None,
        }
    }
}

impl From<&TypeDefVariant<PortableForm>> for ScaleType {
    fn from(raw: &TypeDefVariant<PortableForm>) -> Self {
        let variants = raw.variants();
        if variants.len() == 2 {
            let first = variants[0].name();
            let second = variants[1].name();
            if first == "None" && second == "Some" {
                return Self::from_option(raw);
            } else if first == "Ok" && second == "Err" {
                return Self::from_result(raw);
            }
        }

        ScaleType {
            ty: PrimitiveScaleType::Enum,
            variants: Some(raw.variants().into_iter().map(|v| v.into()).collect()),
            store: None,
            length: None,
            fields: None,
            order: None,
            name: None,
        }
    }
}

impl From<&TypeDefArray<PortableForm>> for ScaleType {
    fn from(raw: &TypeDefArray<PortableForm>) -> Self {
        ScaleType {
            ty: PrimitiveScaleType::List,
            variants: None,
            store: Some(raw.type_param().id()),
            length: Some(raw.len()),
            fields: None,
            order: None,
            name: None,
        }
    }
}

impl From<&TypeDefSequence<PortableForm>> for ScaleType {
    fn from(raw: &TypeDefSequence<PortableForm>) -> Self {
        ScaleType {
            ty: PrimitiveScaleType::List,
            variants: None,
            store: Some(raw.type_param().id()),
            length: None,
            fields: None,
            order: None,
            name: None,
        }
    }
}

impl From<&TypeDefBitSequence<PortableForm>> for ScaleType {
    fn from(raw: &TypeDefBitSequence<PortableForm>) -> Self {
        ScaleType {
            ty: PrimitiveScaleType::List,
            variants: None,
            store: Some(raw.bit_order_type().id()),
            length: None,
            fields: None,
            order: None,
            name: None,
        }
    }
}

impl From<&TypeDefComposite<PortableForm>> for ScaleType {
    fn from(raw: &TypeDefComposite<PortableForm>) -> Self {
        ScaleType {
            ty: PrimitiveScaleType::Struct,
            variants: None,
            store: None,
            length: None,
            fields: Some(raw.fields().into_iter().map(|f| f.into()).collect()),
            order: None,
            name: None,
        }
    }
}

impl From<&TypeDefTuple<PortableForm>> for ScaleType {
    fn from(primitive: &TypeDefTuple<PortableForm>) -> Self {
        ScaleType {
            ty: PrimitiveScaleType::Tuple,
            variants: None,
            store: None,
            length: None,
            fields: Some(
                primitive
                    .fields()
                    .into_iter()
                    .map(|t| t.id().into())
                    .collect(),
            ),
            order: None,
            name: None,
        }
    }
}

impl ScaleType {
    fn new(id: u32, types: &PortableRegistry) -> Self {
        let raw_type = types
            .resolve(id)
            .expect("the metadata defines types it references");

        let mut scale_type = match raw_type.type_def() {
            TypeDef::Primitive(p) => p.into(),
            TypeDef::Compact(c) => c.into(),
            TypeDef::Variant(v) => v.into(),
            TypeDef::Array(a) => a.into(),
            TypeDef::Sequence(s) => s.into(),
            TypeDef::BitSequence(b) => b.into(),
            TypeDef::Composite(c) => {
                if c.fields().len() == 1 {
                    ScaleType::new(c.fields()[0].ty().id(), types)
                } else {
                    c.into()
                }
            }
            TypeDef::Tuple(t) => t.into(),
        };

        match scale_type.ty {
            PrimitiveScaleType::Enum | PrimitiveScaleType::Struct => {
                let parts = raw_type.path();
                let mut path: String = parts
                    .namespace()
                    .into_iter()
                    .map(|p| format!("{}::", p))
                    .collect();

                match parts.ident() {
                    None => (),
                    Some(i) => path += &i,
                };

                scale_type.name = Some(path);
            }
            _ => (),
        }

        scale_type
    }

    fn from_option(variant: &TypeDefVariant<PortableForm>) -> Self {
        ScaleType {
            ty: PrimitiveScaleType::Option,
            variants: None,
            store: Some(variant.variants()[1].fields()[0].ty().id()),
            length: None,
            fields: None,
            order: None,
            name: None,
        }
    }

    fn from_result(variant: &TypeDefVariant<PortableForm>) -> Self {
        let variants = variant.variants();
        let fields = Some(vec![
            Field {
                name: None,
                field: variants[0].fields()[0].ty().id(),
            },
            Field {
                name: None,
                field: variants[1].fields()[0].ty().id(),
            },
        ]);

        ScaleType {
            ty: PrimitiveScaleType::Result,
            variants: None,
            store: None,
            length: None,
            fields,
            order: None,
            name: None,
        }
    }
}

#[wasm_bindgen]
#[derive(Serialize)]
struct Constant {
    name: String,
    #[serde(rename = "type")]
    ty: u32,
    value: Vec<u8>,
    docs: Vec<String>,
}

impl From<PalletConstantMetadata<PortableForm>> for Constant {
    fn from(raw: PalletConstantMetadata<PortableForm>) -> Self {
        Constant {
            name: raw.name.to_string(),
            ty: raw.ty.id(),
            value: raw.value,
            docs: raw.docs.into_iter().map(|s| s.into()).collect(),
        }
    }
}

#[wasm_bindgen]
#[derive(Serialize)]
struct MapDef {
    hashers: Vec<String>,
    key: u32,
    value: u32,
}

impl From<(Vec<StorageHasher>, u32, u32)> for MapDef {
    fn from(raw: (Vec<StorageHasher>, u32, u32)) -> Self {
        MapDef {
            hashers: raw.0.into_iter().map(|h| format!("{:?}", h)).collect(),
            key: raw.1,
            value: raw.2,
        }
    }
}

#[wasm_bindgen]
#[derive(Serialize)]
struct StorageItem {
    name: String,
    #[serde(rename = "type")]
    ty: Option<u32>,
    map: Option<MapDef>,
    docs: Vec<String>,
}

#[wasm_bindgen]
#[derive(Serialize)]
struct StorageItems(Vec<StorageItem>);

impl FromIterator<StorageItem> for StorageItems {
    fn from_iter<T: IntoIterator<Item = StorageItem>>(iter: T) -> Self {
        StorageItems(iter.into_iter().collect())
    }
}

impl From<PalletStorageMetadata<PortableForm>> for StorageItems {
    fn from(raw: PalletStorageMetadata<PortableForm>) -> Self {
        raw.entries
            .into_iter()
            .map(|s| StorageItem {
                name: s.name,
                ty: match s.ty {
                    StorageEntryType::Plain(t) => Some(t.id()),
                    StorageEntryType::Map { .. } => None,
                },
                map: match s.ty {
                    StorageEntryType::Plain(_) => None,
                    StorageEntryType::Map {
                        hashers,
                        key,
                        value,
                    } => Some((hashers, key.id(), value.id()).into()),
                },
                docs: s.docs.into_iter().map(|s| s.into()).collect(),
            })
            .collect()
    }
}

#[wasm_bindgen]
#[derive(Serialize)]
struct Event {
    index: u8,
    name: String,
    fields: Vec<Field>,
    docs: Vec<String>,
}

#[wasm_bindgen]
#[derive(Serialize)]
struct Events(Vec<Event>);

impl FromIterator<Event> for Events {
    fn from_iter<T: IntoIterator<Item = Event>>(iter: T) -> Self {
        Events(iter.into_iter().collect())
    }
}

impl From<(PalletEventMetadata<PortableForm>, &PortableRegistry)> for Events {
    fn from(raw: (PalletEventMetadata<PortableForm>, &PortableRegistry)) -> Self {
        let raw_type = raw
            .1
            .resolve(raw.0.ty.id())
            .expect("the metadata defines types it references");

        if let TypeDef::Variant(e) = raw_type.type_def() {
            e.variants()
                .into_iter()
                .map(|v| Event {
                    index: v.index(),
                    name: v.name().to_string(),
                    fields: v.fields().into_iter().map(|f| f.into()).collect(),
                    docs: v.docs().to_vec(),
                })
                .collect()
        } else {
            panic!("Event metadata must be a Variant type");
        }
    }
}

#[wasm_bindgen]
#[derive(Serialize)]
struct Err {
    index: u8,
    name: String,
    docs: Vec<String>,
}

#[wasm_bindgen]
#[derive(Serialize)]
struct Errors(Vec<Err>);

impl FromIterator<Err> for Errors {
    fn from_iter<T: IntoIterator<Item = Err>>(iter: T) -> Self {
        Errors(iter.into_iter().collect())
    }
}

impl From<(PalletErrorMetadata<PortableForm>, &PortableRegistry)> for Errors {
    fn from(raw: (PalletErrorMetadata<PortableForm>, &PortableRegistry)) -> Self {
        let raw_type = raw
            .1
            .resolve(raw.0.ty.id())
            .expect("the metadata defines types it references");

        if let TypeDef::Variant(e) = raw_type.type_def() {
            e.variants()
                .into_iter()
                .map(|v| Err {
                    index: v.index(),
                    name: v.name().to_string(),
                    docs: v.docs().to_vec(),
                })
                .collect()
        } else {
            panic!("Error metadata must be a Variant type");
        }
    }
}

#[wasm_bindgen]
#[derive(Serialize)]
struct Call {
    index: u8,
    name: String,
    fields: Vec<Field>,
    docs: Vec<String>,
}

#[wasm_bindgen]
#[derive(Serialize)]
struct Calls(Vec<Call>);

impl FromIterator<Call> for Calls {
    fn from_iter<T: IntoIterator<Item = Call>>(iter: T) -> Self {
        Calls(iter.into_iter().collect())
    }
}

impl From<(PalletCallMetadata<PortableForm>, &PortableRegistry)> for Calls {
    fn from(raw: (PalletCallMetadata<PortableForm>, &PortableRegistry)) -> Self {
        let raw_type = raw
            .1
            .resolve(raw.0.ty.id())
            .expect("the metadata defines types it references");

        if let TypeDef::Variant(e) = raw_type.type_def() {
            e.variants()
                .into_iter()
                .map(|v| Call {
                    index: v.index(),
                    name: v.name().to_string(),
                    fields: v.fields().into_iter().map(|f| f.into()).collect(),
                    docs: v.docs().to_vec(),
                })
                .collect()
        } else {
            panic!("Call metadata must be a Variant type");
        }
    }
}

#[wasm_bindgen]
#[derive(Serialize)]
struct Pallet {
    index: u8,
    name: String,
    constants: Vec<Constant>,
    storage: Option<StorageItems>,
    errors: Option<Errors>,
    events: Option<Events>,
    calls: Option<Calls>,
}

impl From<(PalletMetadata<PortableForm>, &PortableRegistry)> for Pallet {
    fn from(raw: (PalletMetadata<PortableForm>, &PortableRegistry)) -> Self {
        Pallet {
            index: raw.0.index,
            name: raw.0.name.to_string(),
            constants: raw.0.constants.into_iter().map(|c| c.into()).collect(),
            storage: raw.0.storage.map(|s| s.into()),
            errors: raw.0.error.map(|e| (e, raw.1).into()),
            events: raw.0.event.map(|e| (e, raw.1).into()),
            calls: raw.0.calls.map(|c| (c, raw.1).into()),
        }
    }
}

#[wasm_bindgen]
#[derive(Serialize)]
struct Types(BTreeMap<u32, ScaleType>);

impl From<PortableRegistry> for Types {
    fn from(raw: PortableRegistry) -> Self {
        let mut idx = BTreeMap::new();
        for ty in raw.types() {
            idx.insert(ty.id(), ScaleType::new(ty.id(), &raw));
        }

        Types(idx)
    }
}

#[wasm_bindgen]
#[derive(Serialize)]
struct SignedExtension {
    name: String,
    #[serde(rename = "type")]
    ty: Option<u32>,
    additional: Option<u32>,
}

impl SignedExtension {
    fn from_metadata(
        raw: SignedExtensionMetadata<PortableForm>,
        types: &PortableRegistry,
    ) -> Option<Self> {
        let raw_ty = types.resolve(raw.ty.id());
        let raw_additional = types.resolve(raw.additional_signed.id());
        if raw_ty.is_none() && raw_additional.is_none() {
            return None;
        }

        let mut ty = Option::<u32>::None;
        match raw_ty.unwrap().type_def() {
            TypeDef::Composite(c) => {
                if c.fields().len() > 0 {
                    ty = Some(raw.ty.id());
                }
            }
            TypeDef::Tuple(t) => {
                if t.fields().len() > 0 {
                    ty = Some(raw.ty.id());
                }
            }
            TypeDef::Variant(v) => {
                if v.variants().len() > 0 {
                    ty = Some(raw.ty.id());
                }
            }
            TypeDef::Array(a) => {
                if a.len() > 0 {
                    ty = Some(raw.ty.id());
                }
            }
            _ => ty = Some(raw.ty.id()),
        }

        let mut additional = Option::<u32>::None;
        match raw_additional.unwrap().type_def() {
            TypeDef::Composite(c) => {
                if c.fields().len() > 0 {
                    additional = Some(raw.additional_signed.id());
                }
            }
            TypeDef::Tuple(t) => {
                if t.fields().len() > 0 {
                    additional = Some(raw.additional_signed.id());
                }
            }
            TypeDef::Variant(v) => {
                if v.variants().len() > 0 {
                    additional = Some(raw.additional_signed.id());
                }
            }
            TypeDef::Array(a) => {
                if a.len() > 0 {
                    additional = Some(raw.additional_signed.id());
                }
            }
            _ => additional = Some(raw.additional_signed.id()),
        }

        if ty.is_none() && additional.is_none() {
            return None;
        }

        Some(SignedExtension {
            ty,
            additional,
            name: raw.identifier,
        })
    }
}

#[wasm_bindgen]
#[derive(Serialize)]
struct Extensions {
    #[serde(rename = "type")]
    version: u8,
    extensions: Vec<SignedExtension>,
}

impl From<(ExtrinsicMetadata<PortableForm>, &PortableRegistry)> for Extensions {
    fn from(raw: (ExtrinsicMetadata<PortableForm>, &PortableRegistry)) -> Self {
        let mut extensions = Vec::new();
        for extension in raw.0.signed_extensions {
            match SignedExtension::from_metadata(extension, raw.1) {
                None => (),
                Some(e) => extensions.push(e),
            }
        }

        Extensions {
            extensions,
            version: raw.0.version,
        }
    }
}

#[wasm_bindgen]
#[derive(Serialize)]
struct Metadata {
    pallets: Vec<Pallet>,
    types: Types,
    signing: Extensions,
}

impl From<RuntimeMetadataV14> for Metadata {
    fn from(raw: RuntimeMetadataV14) -> Self {
        Metadata {
            pallets: raw
                .pallets
                .into_iter()
                .map(|p| (p, &raw.types).into())
                .collect(),
            signing: (raw.extrinsic, &raw.types).into(),
            types: raw.types.into(),
        }
    }
}

#[wasm_bindgen(js_name = metadataFromHex)]
pub fn metadata_from_hex(hex: &[u8]) -> JsValue {
    let pre = match frame_metadata::RuntimeMetadataPrefixed::decode(&mut &*hex) {
        Ok(m) => m.1,
        _ => panic!("Invalid metadata bytes"),
    };

    let meta = match pre {
        frame_metadata::RuntimeMetadata::V14(m) => m,
        _ => panic!("Unsupported metadata version"),
    };

    serde_wasm_bindgen::to_value(&Metadata::from(meta)).unwrap_or(Default::default())
}

#[cfg(test)]
mod tests {
    use crate::Metadata;

    use std::fs;

    use parity_scale_codec::Decode;

    #[test]
    fn it_works() {
        let hex_str = fs::read_to_string(concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/test-assets/westend-v0.9.29-meta.hex"
        ))
        .expect("Cannot find test asset");

        let bytes: Vec<u8> = (2..hex_str.len())
            .step_by(2)
            .map(|i| u8::from_str_radix(&hex_str[i..i + 2], 16))
            .map(|i| i.unwrap())
            .collect();

        let pre = match frame_metadata::RuntimeMetadataPrefixed::decode(&mut &*bytes) {
            Ok(m) => m.1,
            _ => panic!("Invalid metadata bytes"),
        };

        let meta = match pre {
            frame_metadata::RuntimeMetadata::V14(m) => m,
            _ => panic!("Unsupported metadata version"),
        };

        let _ = Metadata::from(meta);
    }
}
