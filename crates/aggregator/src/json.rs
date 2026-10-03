use crate::error::{IngestError, Result};
use serde::{
    Deserialize, Deserializer,
    de::{self, MapAccess, SeqAccess, Visitor},
};
use serde_json::Value;
use std::{collections::HashSet, fmt};

/// JSONB would silently discard duplicate keys. Reject them before publication,
/// and reject NUL strings that PostgreSQL cannot represent. Numeric values are
/// parsed separately by serde_json with arbitrary_precision enabled.
struct UniqueKeys;
impl<'de> Deserialize<'de> for UniqueKeys {
    fn deserialize<D: Deserializer<'de>>(deserializer: D) -> std::result::Result<Self, D::Error> {
        struct Check;
        impl<'de> Visitor<'de> for Check {
            type Value = UniqueKeys;
            fn expecting(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
                f.write_str("JSON without duplicate keys or NUL strings")
            }
            fn visit_unit<E: de::Error>(self) -> std::result::Result<UniqueKeys, E> {
                Ok(UniqueKeys)
            }
            fn visit_bool<E: de::Error>(self, _: bool) -> std::result::Result<UniqueKeys, E> {
                Ok(UniqueKeys)
            }
            fn visit_i64<E: de::Error>(self, _: i64) -> std::result::Result<UniqueKeys, E> {
                Ok(UniqueKeys)
            }
            fn visit_u64<E: de::Error>(self, _: u64) -> std::result::Result<UniqueKeys, E> {
                Ok(UniqueKeys)
            }
            fn visit_f64<E: de::Error>(self, _: f64) -> std::result::Result<UniqueKeys, E> {
                Ok(UniqueKeys)
            }
            fn visit_str<E: de::Error>(self, value: &str) -> std::result::Result<UniqueKeys, E> {
                if value.contains('\0') {
                    Err(E::custom("NUL string"))
                } else {
                    Ok(UniqueKeys)
                }
            }
            fn visit_seq<A: SeqAccess<'de>>(
                self,
                mut sequence: A,
            ) -> std::result::Result<UniqueKeys, A::Error> {
                while sequence.next_element::<UniqueKeys>()?.is_some() {}
                Ok(UniqueKeys)
            }
            fn visit_map<A: MapAccess<'de>>(
                self,
                mut map: A,
            ) -> std::result::Result<UniqueKeys, A::Error> {
                let mut keys = HashSet::new();
                while let Some(key) = map.next_key::<String>()? {
                    if key.contains('\0') || !keys.insert(key) {
                        return Err(de::Error::custom("invalid object key"));
                    }
                    map.next_value::<UniqueKeys>()?;
                }
                Ok(UniqueKeys)
            }
        }
        deserializer.deserialize_any(Check)
    }
}

pub fn parse(bytes: &[u8]) -> Result<Value> {
    serde_json::from_slice::<UniqueKeys>(bytes)
        .map_err(|_| IngestError::new("invalid_record_json"))?;
    Ok(serde_json::from_slice(bytes)?)
}
