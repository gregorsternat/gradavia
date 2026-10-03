use crate::error::{IngestError, Result};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::BTreeMap;

pub const CATALOG_BASE: &str =
    "https://data.enseignementsup-recherche.gouv.fr/api/explore/v2.1/catalog/datasets/";
pub const IMPORTER_VERSION: &str = concat!(env!("CARGO_PKG_VERSION"), "/raw-v1");

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
pub struct Field {
    pub name: String,
    pub kind: String,
    pub multivalued: Option<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct Dataset {
    pub id: String,
    pub family: String,
    pub provider: String,
    pub contract_version: u32,
    pub campaign_field: Option<String>,
    pub fixed_campaign: Option<i32>,
    pub establishment_field: Option<String>,
    pub formation_field: Option<String>,
    pub reviewed_campaigns: Vec<i32>,
    pub archived: bool,
    pub fields: Vec<Field>,
}

pub fn datasets() -> Result<Vec<Dataset>> {
    Ok(serde_json::from_str(include_str!(
        "../sources/registry.json"
    ))?)
}

pub fn dataset(id: &str) -> Result<Dataset> {
    datasets()?
        .into_iter()
        .find(|source| source.id == id)
        .ok_or_else(|| IngestError::new("unknown_dataset"))
}

pub fn catalog_fields(metadata: &Value) -> Result<Vec<Field>> {
    let fields = metadata["fields"]
        .as_array()
        .ok_or_else(|| IngestError::new("missing_source_schema"))?;
    let mut result = Vec::with_capacity(fields.len());
    for value in fields {
        result.push(Field {
            name: value["name"]
                .as_str()
                .ok_or_else(|| IngestError::new("invalid_source_schema"))?
                .to_owned(),
            kind: value["type"]
                .as_str()
                .ok_or_else(|| IngestError::new("invalid_source_schema"))?
                .to_owned(),
            multivalued: value["annotations"]["multivalued"]
                .as_str()
                .map(str::to_owned),
        });
    }
    result.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(result)
}

impl Dataset {
    pub fn validate_metadata(&self, metadata: &Value) -> Result<()> {
        if metadata["dataset_id"].as_str() != Some(&self.id) {
            return Err(IngestError::new("dataset_identity_mismatch"));
        }
        let actual = catalog_fields(metadata)?;
        if actual != self.fields {
            let expected: BTreeMap<_, _> = self.fields.iter().map(|f| (&f.name, f)).collect();
            let observed: BTreeMap<_, _> = actual.iter().map(|f| (&f.name, f)).collect();
            let name = expected
                .keys()
                .chain(observed.keys())
                .find(|name| expected.get(*name) != observed.get(*name));
            return Err(name.map_or_else(
                || IngestError::new("schema_drift"),
                |name| IngestError::new("schema_drift").field(name),
            ));
        }
        if metadata["metas"]["default"]["license"]
            .as_str()
            .is_none_or(str::is_empty)
        {
            return Err(IngestError::new("missing_license"));
        }
        Ok(())
    }

    /// Validate representation only. Do not interpret statistical values or masks.
    pub fn project(&self, record: &Value) -> Result<Projection> {
        let object = record
            .as_object()
            .ok_or_else(|| IngestError::new("record_not_object"))?;
        for (name, value) in object {
            let field = self
                .fields
                .iter()
                .find(|f| &f.name == name)
                .ok_or_else(|| IngestError::new("unknown_record_field").field(name))?;
            if value.is_null() {
                continue;
            }
            let valid = if field.multivalued.is_some() {
                value
                    .as_array()
                    .is_some_and(|values| values.iter().all(Value::is_string))
            } else {
                match field.kind.as_str() {
                    "text" => value.is_string(),
                    "int" => value.as_number().is_some_and(|n| {
                        let text = n.as_str();
                        !text.is_empty()
                            && text
                                .trim_start_matches('-')
                                .chars()
                                .all(|c| c.is_ascii_digit())
                    }),
                    "double" => value.is_number(),
                    "boolean" => value.is_boolean(),
                    "geo_point_2d" => value.as_object().is_some_and(|p| {
                        p.len() == 2
                            && p.get("lat").is_some_and(Value::is_number)
                            && p.get("lon").is_some_and(Value::is_number)
                    }),
                    _ => false,
                }
            };
            if !valid {
                return Err(IngestError::new("invalid_field_type").field(name));
            }
        }
        let campaign = if let Some(year) = self.fixed_campaign {
            year
        } else {
            let field = self
                .campaign_field
                .as_ref()
                .ok_or_else(|| IngestError::new("invalid_contract"))?;
            let text = record[field]
                .as_str()
                .ok_or_else(|| IngestError::new("missing_campaign").field(field))?;
            if text.len() != 4 || !text.bytes().all(|b| b.is_ascii_digit()) {
                return Err(IngestError::new("invalid_campaign").field(field));
            }
            text.parse()
                .map_err(|_| IngestError::new("invalid_campaign").field(field))?
        };
        if !(1900..=2200).contains(&campaign) {
            return Err(IngestError::new("invalid_campaign"));
        }
        let identifier = |field: &Option<String>| -> Result<Option<String>> {
            match field.as_ref().and_then(|name| object.get(name)) {
                None | Some(Value::Null) => Ok(None),
                Some(Value::String(text)) => Ok(Some(text.clone())),
                _ => Err(IngestError::new("invalid_source_identifier")),
            }
        };
        Ok(Projection {
            campaign,
            establishment_id: identifier(&self.establishment_field)?,
            formation_id: identifier(&self.formation_field)?,
        })
    }
}

#[derive(Debug)]
pub struct Projection {
    pub campaign: i32,
    pub establishment_id: Option<String>,
    pub formation_id: Option<String>,
}
