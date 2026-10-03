use super::{metrics::Definition, repository::begin};
use crate::formations::{
    domain::{CampaignSource, MAX_QUERY_BYTES},
    repository::{ReadError, decode_campaigns},
};
use orvio_core::metrics::MetricValue;
use serde::Serialize;
use serde_json::Value;
use sqlx::{PgPool, Row};
use std::collections::BTreeMap;

pub const DATASET_ID: &str = "fr-esr-parcoursup-enseignements-de-specialite-bacheliers-generaux-3";

#[derive(Clone, Debug, Serialize)]
pub struct Pair {
    pub id: String,
    pub label: String,
    pub specialties: Vec<String>,
}
#[derive(Debug, Serialize)]
pub struct Query {
    pub paire: String,
    pub groupe: String,
}
impl Query {
    pub fn parse(raw: &str) -> Result<Self, &'static str> {
        if raw.len() > MAX_QUERY_BYTES {
            return Err("Query exceeds 16384 bytes");
        }
        let parameters: Vec<_> = url::form_urlencoded::parse(raw.as_bytes()).collect();
        let value = |key| {
            parameters
                .iter()
                .find(|(name, _)| name == key)
                .map(|(_, value)| value.chars().take(800).collect())
                .unwrap_or_default()
        };
        Ok(Self {
            paire: value("paire"),
            groupe: value("groupe"),
        })
    }
}
#[derive(Debug, Serialize)]
pub struct Observation {
    pub id: String,
    pub group: String,
    pub formation: String,
    pub applications: MetricValue,
    pub offers: MetricValue,
    pub accepted: MetricValue,
}
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SpecialtyData {
    pub source: CampaignSource,
    pub campaigns: Vec<i32>,
    pub query: Query,
    pub pairs: Vec<Pair>,
    pub selected_pair: Pair,
    pub national: Option<Observation>,
    pub groups: Vec<Observation>,
    pub formations: Vec<Observation>,
    pub definitions: Vec<Definition>,
    pub notices: Vec<String>,
    pub request_notices: Vec<String>,
}
#[derive(Debug, Serialize)]
#[serde(tag = "status", rename_all = "lowercase")]
pub enum SpecialtyResult {
    Ready { data: Box<SpecialtyData> },
    Empty,
}

fn field(payload: &Value, field: &str) -> Result<String, ReadError> {
    payload[field]
        .as_str()
        .filter(|s| !s.trim().is_empty())
        .map(str::to_owned)
        .ok_or(ReadError)
}
fn metric(payload: &Value, field: &str) -> MetricValue {
    let raw = match payload.get(field) {
        None | Some(Value::Null) => None,
        Some(Value::String(text)) => Some(text.clone()),
        Some(value) => Some(value.to_string()),
    };
    MetricValue::parse(field, raw.as_deref(), false)
}
fn observation(
    source: &CampaignSource,
    row_number: i64,
    payload: &Value,
) -> Result<Observation, ReadError> {
    Ok(Observation {
        id: format!("{}:{row_number}", source.release_id),
        group: field(payload, "regroupement_de_formations")?,
        formation: field(payload, "formation")?,
        applications: metric(payload, "voeux"),
        offers: metric(payload, "propositions_d_admissions"),
        accepted: metric(payload, "acceptations"),
    })
}
fn pair(payload: &Value) -> Result<Pair, ReadError> {
    let specialties: Vec<String> = serde_json::from_value(payload["doublette"].clone())?;
    if specialties.len() != 2 || specialties.iter().any(|s| s.trim().is_empty()) {
        return Err(ReadError);
    }
    Ok(Pair {
        id: serde_json::to_string(&specialties)?,
        label: specialties.join(" + "),
        specialties,
    })
}

pub async fn read(pool: &PgPool, mut query: Query) -> Result<SpecialtyResult, ReadError> {
    let mut tx = begin(pool).await?;
    let rows = sqlx::query(include_str!("specialty-source.sql"))
        .bind([DATASET_ID].as_slice())
        .persistent(false)
        .fetch_all(&mut *tx)
        .await?;
    let source = decode_campaigns(rows)?
        .into_iter()
        .find(|source| source.campaign == 2025);
    let Some(source) = source else {
        tx.commit().await?;
        return Ok(SpecialtyResult::Empty);
    };
    let national_rows = sqlx::query("SELECT row_number,payload FROM raw_records WHERE release_id=$1::uuid AND campaign=$2 AND payload->>'niveau_d_agregation'='0' ORDER BY row_number LIMIT 501")
        .bind(&source.release_id).bind(source.campaign).persistent(false).fetch_all(&mut *tx).await?;
    if national_rows.is_empty() || national_rows.len() > 500 {
        return Err(ReadError);
    }
    let mut pairs: BTreeMap<String, Pair> = BTreeMap::new();
    let mut default_pair: Option<(f64, String)> = None;
    for row in &national_rows {
        let payload: Value = row.try_get("payload")?;
        let pair = pair(&payload)?;
        let applications = metric(&payload, "voeux").value.unwrap_or(-1.0);
        if default_pair.as_ref().is_none_or(|(count, id)| {
            applications > *count || (applications == *count && pair.id < *id)
        }) {
            default_pair = Some((applications, pair.id.clone()));
        }
        pairs.insert(pair.id.clone(), pair);
    }
    let mut request_notices = Vec::new();
    if !pairs.contains_key(&query.paire) {
        if !query.paire.is_empty() {
            request_notices.push("Cette combinaison de spécialités n’est pas publiée. La combinaison la plus représentée est affichée.".into());
        }
        query.paire = default_pair.ok_or(ReadError)?.1;
    }
    let selected_pair = pairs.get(&query.paire).ok_or(ReadError)?.clone();
    let pair_json: Value = serde_json::from_str(&selected_pair.id)?;
    let rows = sqlx::query("SELECT row_number,payload FROM raw_records WHERE release_id=$1::uuid AND campaign=$2 AND payload->'doublette'=$3::jsonb ORDER BY row_number LIMIT 5001")
        .bind(&source.release_id).bind(source.campaign).bind(pair_json).persistent(false).fetch_all(&mut *tx).await?;
    if rows.len() > 5_000 {
        return Err(ReadError);
    }
    let mut national = Vec::new();
    let mut groups = Vec::new();
    let mut formations = Vec::new();
    for row in rows {
        let payload: Value = row.try_get("payload")?;
        let item = observation(&source, row.try_get("row_number")?, &payload)?;
        match payload["niveau_d_agregation"].as_str() {
            Some("0") => national.push(item),
            Some("1") => groups.push(item),
            Some("2") => {
                if item.group == query.groupe {
                    formations.push(item);
                }
            }
            _ => return Err(ReadError),
        }
    }
    if !query.groupe.is_empty() && !groups.iter().any(|group| group.group == query.groupe) {
        query.groupe.clear();
        formations.clear();
        request_notices.push(
            "Ce regroupement n’est pas publié pour cette combinaison et a été retiré.".into(),
        );
    }
    if national.len() != 1 {
        request_notices.push("Plusieurs lignes nationales portent cette combinaison : aucun total national n’est agrégé.".into());
    }
    let national = if national.len() == 1 {
        national.pop()
    } else {
        None
    };
    groups.sort_by(|a, b| a.group.cmp(&b.group).then(a.id.cmp(&b.id)));
    formations.sort_by(|a, b| a.formation.cmp(&b.formation).then(a.id.cmp(&b.id)));
    let definitions = [
        ("applications","voeux","Candidats ayant confirmé un vœu","Nombre de bacheliers généraux de la combinaison ayant confirmé au moins un vœu dans le périmètre de cette ligne."),
        ("offers","propositions_d_admissions","Candidats ayant reçu une proposition","Nombre de bacheliers généraux de la combinaison ayant reçu au moins une proposition dans le périmètre de cette ligne."),
        ("accepted","acceptations","Candidats ayant accepté une proposition","Nombre de bacheliers généraux de la combinaison ayant accepté une proposition dans le périmètre de cette ligne."),
    ].into_iter().map(|(key,field,label,description)| Definition { key:key.into(),field:field.into(),label:label.into(),unit:"count",description:description.into() }).collect();
    tx.commit().await?;
    Ok(SpecialtyResult::Ready { data: Box::new(SpecialtyData { campaigns:vec![source.campaign],source,query,pairs:pairs.into_values().collect(),selected_pair,national,groups,formations,definitions,request_notices,notices:vec!["Bacheliers généraux 2025, selon leur combinaison de spécialités. Le total national provient du niveau 0 ; les regroupements du niveau 1 ; les formations du niveau 2.".into(),"Une personne peut avoir confirmé des vœux ou reçu des propositions dans plusieurs regroupements. Les lignes et niveaux ne s’additionnent pas. Ces observations ne prédisent pas une admission et n’isolent pas l’effet des spécialités.".into()] }) })
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    #[test]
    fn pair_identity_is_opaque_and_validated() {
        let input = json!({"doublette":["Mathématiques","Physique-Chimie"]});
        let pair = pair(&input).unwrap();
        assert_eq!(
            serde_json::from_str::<Value>(&pair.id).unwrap(),
            input["doublette"]
        );
        assert!(super::pair(&json!({"doublette":["Only one"]})).is_err());
    }
}
