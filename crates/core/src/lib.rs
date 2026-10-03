//! Pure domain types. No database, network, filesystem, or runtime dependencies.
//!
//! Source adapters will attach provenance to every imported release. Metric
//! definitions and formation matching belong here when their features are built.

use serde::{Deserialize, Serialize};
use thiserror::Error;

pub mod metrics;

/// A source reference is opaque: identifiers are only unique within their source.
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct SourceId(String);

#[derive(Debug, Error, PartialEq, Eq)]
#[error("source identifier must be non-empty and contain no whitespace")]
pub struct InvalidSourceId;

impl SourceId {
    pub fn new(value: impl Into<String>) -> Result<Self, InvalidSourceId> {
        let value = value.into();
        if value.is_empty() || value.chars().any(char::is_whitespace) {
            return Err(InvalidSourceId);
        }
        Ok(Self(value))
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }
}

impl<'de> Deserialize<'de> for SourceId {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        Self::new(String::deserialize(deserializer)?).map_err(serde::de::Error::custom)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn source_identifiers_remain_opaque() {
        assert_eq!(
            SourceId::new("mesr:parcoursup").unwrap().as_str(),
            "mesr:parcoursup"
        );
    }

    #[test]
    fn rejects_empty_or_ambiguous_identifiers() {
        for value in ["", " ", " parcoursup", "parcoursup\n2025"] {
            assert_eq!(SourceId::new(value), Err(InvalidSourceId));
        }
    }
}
