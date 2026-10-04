use super::{DATASET_ID, Observation, Pair, field, observation, pair};
use crate::analytics::repository::begin;
use crate::formations::{
    domain::{CampaignSource, MAX_QUERY_BYTES},
    repository::{ReadError, decode_campaigns},
};
use serde::Serialize;
use serde_json::Value;
use sqlx::{PgPool, Row};

#[derive(Debug, Serialize)]
pub struct Query {
    pub formation: String,
}
impl Query {
    pub fn parse(raw: &str) -> Result<Self, &'static str> {
        if raw.len() > MAX_QUERY_BYTES {
            return Err("Query exceeds 16384 bytes");
        }
        Ok(Self {
            formation: url::form_urlencoded::parse(raw.as_bytes())
                .find(|(key, _)| key == "formation")
                .map(|(_, value)| value.chars().take(1600).collect())
                .unwrap_or_default(),
        })
    }
}
#[derive(Debug, Serialize)]
pub struct Formation {
    pub id: String,
    pub group: String,
    pub label: String,
}
#[derive(Debug, Serialize)]
pub struct PairObservation {
    pub pair: Pair,
    #[serde(flatten)]
    pub observation: Observation,
}
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Data {
    pub source: CampaignSource,
    pub query: Query,
    pub formations: Vec<Formation>,
    pub rows: Vec<PairObservation>,
    pub notices: Vec<String>,
    pub request_notices: Vec<String>,
}
#[derive(Debug, Serialize)]
#[serde(tag = "status", rename_all = "lowercase")]
pub enum ResultData {
    Ready { data: Box<Data> },
    Empty,
}

pub async fn read(pool: &PgPool, mut query: Query) -> Result<ResultData, ReadError> {
    let mut tx = begin(pool).await?;
    let sources = sqlx::query(include_str!("../specialty-source.sql"))
        .bind([DATASET_ID].as_slice())
        .persistent(false)
        .fetch_all(&mut *tx)
        .await?;
    let Some(source) = decode_campaigns(sources)?
        .into_iter()
        .find(|source| source.campaign == 2025)
    else {
        tx.commit().await?;
        return Ok(ResultData::Empty);
    };
    let catalog = sqlx::query("SELECT DISTINCT payload->>'regroupement_de_formations' AS group_label,payload->>'formation' AS formation_label FROM raw_records WHERE release_id=$1::uuid AND campaign=$2 AND payload->>'niveau_d_agregation'='2' ORDER BY formation_label,group_label LIMIT 2001")
        .bind(&source.release_id).bind(source.campaign).persistent(false).fetch_all(&mut *tx).await?;
    if catalog.len() > 2000 {
        return Err(ReadError);
    }
    let mut formations = Vec::new();
    for row in catalog {
        let group: String = row.try_get("group_label")?;
        let label: String = row.try_get("formation_label")?;
        if group.trim().is_empty() || label.trim().is_empty() {
            return Err(ReadError);
        }
        formations.push(Formation {
            id: serde_json::to_string(&[&group, &label])?,
            group,
            label,
        });
    }
    let mut request_notices = Vec::new();
    if !query.formation.is_empty()
        && !formations
            .iter()
            .any(|formation| formation.id == query.formation)
    {
        query.formation.clear();
        request_notices.push(
            "Ce libellé national n’est pas publié. Choisissez une formation dans la liste.".into(),
        );
    }
    let mut rows = Vec::new();
    if let Some(selected) = formations
        .iter()
        .find(|formation| formation.id == query.formation)
    {
        let records = sqlx::query("SELECT row_number,payload FROM raw_records WHERE release_id=$1::uuid AND campaign=$2 AND payload->>'niveau_d_agregation'='2' AND payload->>'regroupement_de_formations'=$3 AND payload->>'formation'=$4 ORDER BY row_number LIMIT 1001")
            .bind(&source.release_id).bind(source.campaign).bind(&selected.group).bind(&selected.label).persistent(false).fetch_all(&mut *tx).await?;
        if records.len() > 1000 {
            return Err(ReadError);
        }
        for record in records {
            let payload: Value = record.try_get("payload")?;
            // Read fields again through the adapter validator before returning the observation.
            field(&payload, "formation")?;
            rows.push(PairObservation {
                pair: pair(&payload)?,
                observation: observation(&source, record.try_get("row_number")?, &payload)?,
            });
        }
    }
    rows.sort_by(|a, b| {
        a.pair
            .label
            .cmp(&b.pair.label)
            .then(a.observation.id.cmp(&b.observation.id))
    });
    tx.commit().await?;
    Ok(ResultData::Ready { data: Box::new(Data { source, query, formations, rows, request_notices, notices: vec!["Bacheliers généraux 2025 : lignes nationales par libellé de formation et regroupement. Ces données ne décrivent pas le recrutement d’un établissement ou d’un campus.".into(), "Chaque ligne conserve ses effectifs publiés. Les candidatures et les propositions ne s’additionnent pas entre formations ; aucune probabilité individuelle d’admission n’est calculée.".into()] }) })
}

#[cfg(test)]
mod tests {
    use super::Query;
    #[test]
    fn query_bounds_and_preserves_opaque_identity() {
        assert_eq!(
            Query::parse("formation=%5B%22Licence%22%2C%22Droit%22%5D")
                .unwrap()
                .formation,
            "[\"Licence\",\"Droit\"]"
        );
        assert!(Query::parse(&"x".repeat(16385)).is_err());
        assert_eq!(
            Query::parse(&format!("formation={}", "x".repeat(2000)))
                .unwrap()
                .formation
                .len(),
            1600
        );
    }
}
