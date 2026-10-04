use super::domain::{
    CampaignSource, ExplorerData, ExplorerQuery, ExplorerResult, Formation, parcoursup_link,
    source_text,
};
use serde::Deserialize;
use serde_json::Value;
use sqlx::{PgConnection, PgPool, Row, postgres::PgRow};

const SOURCE_IDS: [&str; 8] = [
    "fr-esr-parcoursup-2018",
    "fr-esr-parcoursup-2019",
    "fr-esr-parcoursup_2020",
    "fr-esr-parcoursup_2021",
    "fr-esr-parcoursup_2022",
    "fr-esr-parcoursup_2023",
    "fr-esr-parcoursup_2024",
    "fr-esr-parcoursup",
];

// Deliberately carries no raw driver error, connection string or source payload.
#[derive(Debug)]
pub struct ReadError;

impl From<sqlx::Error> for ReadError {
    fn from(_: sqlx::Error) -> Self {
        Self
    }
}

impl From<serde_json::Error> for ReadError {
    fn from(_: serde_json::Error) -> Self {
        Self
    }
}

pub(crate) async fn campaigns(
    connection: &mut PgConnection,
) -> Result<Vec<CampaignSource>, ReadError> {
    let rows = sqlx::query(include_str!("campaigns.sql"))
        .bind(SOURCE_IDS.as_slice())
        .persistent(false)
        .fetch_all(connection)
        .await?;
    decode_campaigns(rows)
}

pub(crate) async fn release_campaigns(
    connection: &mut PgConnection,
    release_id: &str,
) -> Result<Vec<CampaignSource>, ReadError> {
    let rows = sqlx::query(include_str!("release.sql"))
        .bind(SOURCE_IDS.as_slice())
        .bind(release_id)
        .persistent(false)
        .fetch_all(connection)
        .await?;
    decode_campaigns(rows)
}

pub(crate) fn decode_campaigns(rows: Vec<PgRow>) -> Result<Vec<CampaignSource>, ReadError> {
    let mut sources = Vec::new();
    for row in rows {
        let coverage: Value = row.try_get("campaigns")?;
        let fields: Vec<String> = serde_json::from_value(row.try_get("fields")?)?;
        for campaign in coverage.as_object().ok_or(ReadError)?.keys() {
            if campaign.len() != 4 || !campaign.bytes().all(|c| c.is_ascii_digit()) {
                return Err(ReadError);
            }
            sources.push(CampaignSource {
                campaign: campaign.parse().map_err(|_| ReadError)?,
                release_id: row.try_get("release_id")?,
                dataset_id: row.try_get("dataset_id")?,
                provider: source_text(row.try_get("provider")?)
                    .unwrap_or_else(|| "MESR / SIES".into()),
                license: row.try_get("license")?,
                collected_at: row.try_get("collected_at")?,
                modified_at: row.try_get("modified_at")?,
                fields: fields.clone(),
            });
        }
    }
    // Coverage comes from release metadata. IDs only distinguish the mutable alias.
    sources.sort_by_key(|s| {
        (
            std::cmp::Reverse(s.campaign),
            s.dataset_id == "fr-esr-parcoursup",
        )
    });
    sources.dedup_by_key(|s| s.campaign);
    Ok(sources)
}

#[derive(Deserialize)]
pub(crate) struct DescriptiveRow {
    pub(crate) row_number: i64,
    title: String,
    establishment: Option<String>,
    city: Option<String>,
    departement: Option<String>,
    region: Option<String>,
    r#type: Option<String>,
    statut: Option<String>,
    selectivite: Option<String>,
    parcoursup_url: Option<String>,
    raw_payload: Value,
}

pub async fn read(pool: &PgPool, mut query: ExplorerQuery) -> Result<ExplorerResult, ReadError> {
    let mut tx = pool.begin().await?;
    // Both settings stay transaction-scoped through Neon transaction pooling.
    sqlx::raw_sql("SET TRANSACTION READ ONLY; SET LOCAL statement_timeout = '8s'")
        .execute(&mut *tx)
        .await?;
    let sources = campaigns(&mut tx).await?;
    let Some((source, notices)) = query.resolve(&sources) else {
        tx.commit().await?;
        return Ok(ExplorerResult::Empty);
    };
    let row = sqlx::query(include_str!("explorer.sql"))
        .bind(&source.release_id)
        .bind(source.campaign)
        .bind(&query.q)
        .bind(&query.r#type)
        .bind(&query.region)
        .bind(&query.departement)
        .bind(&query.statut)
        .bind(&query.selectivite)
        .bind(query.page)
        .bind(&query.tri)
        .persistent(false)
        .fetch_one(&mut *tx)
        .await?;
    query.page = row.try_get("page")?;
    let rows: Vec<DescriptiveRow> = serde_json::from_value(row.try_get("formations")?)?;
    let formations = rows
        .into_iter()
        .map(|row| row.formation(&source.release_id))
        .collect();
    let data = ExplorerData {
        source,
        campaigns: sources.into_iter().map(|s| s.campaign).collect(),
        query,
        notices,
        formations,
        facets: serde_json::from_value(row.try_get("facets")?)?,
        total: row.try_get("total")?,
    };
    tx.commit().await?;
    Ok(ExplorerResult::Ready {
        data: Box::new(data),
    })
}

impl DescriptiveRow {
    pub(crate) fn formation(self, release_id: &str) -> Formation {
        Formation {
            id: format!("{release_id}:{}", self.row_number),
            title: self.title,
            establishment: source_text(self.establishment),
            city: source_text(self.city),
            department: source_text(self.departement),
            region: source_text(self.region),
            r#type: source_text(self.r#type),
            status: source_text(self.statut),
            selectivity: source_text(self.selectivite),
            parcoursup_url: parcoursup_link(self.parcoursup_url.as_deref()),
            source_formation_id: source_text(
                self.raw_payload["cod_aff_form"]
                    .as_str()
                    .map(str::to_string),
            ),
            metrics: crate::analytics::metrics::metrics(&self.raw_payload),
        }
    }
}
