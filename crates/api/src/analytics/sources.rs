use crate::formations::repository::ReadError;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sqlx::{PgPool, Row};

#[derive(Deserialize)]
struct RegisteredSource {
    id: String,
    family: String,
    provider: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Dataset {
    dataset_id: String,
    family: String,
    provider: String,
    title: String,
    source_url: String,
    status: &'static str,
    release_id: Option<String>,
    campaigns: Vec<i32>,
    row_count: Option<i64>,
    collected_at: Option<String>,
    modified_at: Option<String>,
    license: Option<String>,
}
#[derive(Serialize)]
pub struct InventoryTotals {
    datasets: usize,
    published: usize,
    records: i64,
}
#[derive(Serialize)]
pub struct Inventory {
    datasets: Vec<Dataset>,
    totals: InventoryTotals,
    notices: Vec<String>,
}
#[derive(Serialize)]
pub struct SourcesResult {
    status: &'static str,
    data: Inventory,
}

pub async fn read(pool: &PgPool) -> Result<SourcesResult, ReadError> {
    // Share the collector's committed source catalog without linking its I/O crate.
    let registry: Vec<RegisteredSource> =
        serde_json::from_str(include_str!("../../../aggregator/sources/registry.json"))?;
    let mut tx = super::repository::begin(pool).await?;
    let rows = sqlx::query("SELECT d.id, r.id::text AS release_id, r.row_count, r.campaigns, r.license, r.metadata #>> '{metas,default,title}' AS title, to_char(r.collected_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"') AS collected_at, to_char(r.source_modified_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"') AS modified_at FROM source_datasets d LEFT JOIN source_releases r ON r.id = d.current_release_id WHERE d.id = ANY($1)")
        .bind(registry.iter().map(|source| source.id.as_str()).collect::<Vec<_>>())
        .persistent(false).fetch_all(&mut *tx).await?;
    let mut datasets = Vec::new();
    let mut totals = InventoryTotals {
        datasets: registry.len(),
        published: 0,
        records: 0,
    };
    for registered in registry {
        let row = rows
            .iter()
            .find(|row| row.get::<String, _>("id") == registered.id);
        let release_id = row
            .map(|r| r.try_get::<Option<String>, _>("release_id"))
            .transpose()?
            .flatten();
        let row_count = row
            .map(|r| r.try_get::<Option<i64>, _>("row_count"))
            .transpose()?
            .flatten();
        let coverage = row
            .map(|r| r.try_get::<Option<Value>, _>("campaigns"))
            .transpose()?
            .flatten();
        let mut campaigns: Vec<i32> = coverage
            .as_ref()
            .and_then(Value::as_object)
            .map(|v| {
                v.keys()
                    .map(|key| key.parse::<i32>().map_err(|_| ReadError))
                    .collect()
            })
            .transpose()?
            .unwrap_or_default();
        campaigns.sort();
        let text = |field| -> Result<Option<String>, ReadError> {
            Ok(row
                .map(|r| r.try_get::<Option<String>, _>(field))
                .transpose()?
                .flatten())
        };
        if release_id.is_some() {
            totals.published += 1;
            totals.records += row_count.unwrap_or_default();
        }
        datasets.push(Dataset {
            source_url: format!(
                "https://data.enseignementsup-recherche.gouv.fr/explore/dataset/{}/",
                registered.id
            ),
            title: text("title")?
                .filter(|s| !s.trim().is_empty())
                .unwrap_or_else(|| registered.id.clone()),
            dataset_id: registered.id,
            family: registered.family,
            provider: registered.provider,
            status: if release_id.is_some() {
                "published"
            } else {
                "not-imported"
            },
            release_id,
            campaigns,
            row_count,
            collected_at: text("collected_at")?,
            modified_at: text("modified_at")?,
            license: text("license")?,
        });
    }
    tx.commit().await?;
    Ok(SourcesResult { status: "ready", data: Inventory { datasets, totals, notices: vec!["Les lignes brutes n’ont pas toutes la même unité : formations, candidatures, spécialités et cartographie. Leur somme décrit le volume archivé, pas une population.".into(), "Les données APB et l’apprentissage sont conservés séparément. Les visualisations d’admission portent sur les campagnes Parcoursup hors apprentissage.".into()] } })
}
