use super::metrics::{Definition, FIELDS, Metrics, definitions, metrics};
use crate::formations::{
    domain::{CampaignSource, ExplorerQuery, Formation},
    repository::{DescriptiveRow, ReadError, campaigns, release_campaigns},
};
use gradavia_core::metrics::{MetricValue, ValueState};
use serde::Serialize;
use serde_json::Value;
use sqlx::{PgConnection, PgPool, Row};
use std::{
    collections::{BTreeMap, BTreeSet, VecDeque},
    sync::{Mutex, OnceLock},
};

#[derive(Clone, Debug, Default, Serialize)]
pub struct Total {
    pub value: Option<f64>,
    pub observed: usize,
    pub total: usize,
}
impl Total {
    fn push(&mut self, metric: &MetricValue) {
        self.total += 1;
        if let Some(value) = metric.value {
            self.value = Some(self.value.unwrap_or_default() + value);
            self.observed += 1;
        }
    }
}

#[derive(Clone, Debug, Default, Serialize)]
pub struct Totals {
    pub formations: usize,
    pub establishments: usize,
    pub capacity: Total,
    pub applications: Total,
    pub admitted: Total,
}
#[derive(Clone, Debug, Default, Serialize)]
pub struct Breakdown {
    pub label: String,
    pub formations: usize,
    pub capacity: Total,
    pub applications: Total,
    pub admitted: Total,
}
impl Breakdown {
    fn push(&mut self, values: &Metrics) {
        self.formations += 1;
        self.capacity.push(&values["capacity"]);
        self.applications.push(&values["applications"]);
        self.admitted.push(&values["admitted"]);
    }
}
#[derive(Clone, Debug, Default, Serialize)]
pub struct Coverage {
    pub key: String,
    pub observed: usize,
    pub missing: usize,
    pub suppressed: usize,
    pub invalid: usize,
}
#[derive(Clone, Debug, Serialize)]
pub struct AccessBucket {
    pub label: String,
    pub min: usize,
    pub max: usize,
    pub count: usize,
}
#[derive(Clone, Debug, Serialize)]
pub struct CampaignObservation {
    pub source: CampaignSource,
    pub campaign: i32,
    pub formations: usize,
    pub capacity: Total,
    pub admitted: Total,
}
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Overview {
    pub source: CampaignSource,
    pub campaigns: Vec<i32>,
    pub totals: Totals,
    pub by_type: Vec<Breakdown>,
    pub by_region: Vec<Breakdown>,
    pub access_distribution: Vec<AccessBucket>,
    pub coverage: Vec<Coverage>,
    pub history: Vec<CampaignObservation>,
    pub notices: Vec<String>,
    pub request_notices: Vec<String>,
}
#[derive(Clone, Debug, Serialize)]
#[serde(tag = "status", rename_all = "lowercase")]
pub enum OverviewResult {
    Ready { data: Box<Overview> },
    Empty,
}

pub(super) async fn begin(
    pool: &PgPool,
) -> Result<sqlx::Transaction<'_, sqlx::Postgres>, ReadError> {
    let mut tx = pool.begin().await?;
    sqlx::raw_sql("SET TRANSACTION READ ONLY; SET LOCAL statement_timeout = '8s'")
        .execute(&mut *tx)
        .await?;
    Ok(tx)
}

struct CachedOverview {
    key: String,
    overview: Overview,
}
type HistoricalSnapshots = VecDeque<(String, Vec<CampaignObservation>)>;
static HISTORIES: OnceLock<Mutex<HistoricalSnapshots>> = OnceLock::new();

static OVERVIEWS: OnceLock<Mutex<VecDeque<CachedOverview>>> = OnceLock::new();

fn cached_overview(key: &str) -> Option<Overview> {
    let mut entries = OVERVIEWS.get_or_init(Mutex::default).lock().ok()?;
    let position = entries.iter().position(|entry| entry.key == key)?;
    let entry = entries.remove(position)?;
    let overview = entry.overview.clone();
    entries.push_back(entry);
    Some(overview)
}

fn cache_overview(key: String, overview: &Overview) {
    if let Ok(mut entries) = OVERVIEWS.get_or_init(Mutex::default).lock() {
        entries.retain(|entry| entry.key != key);
        while entries.len() >= 8 {
            entries.pop_front();
        }
        entries.push_back(CachedOverview {
            key,
            overview: overview.clone(),
        });
    }
}

pub async fn overview(
    pool: &PgPool,
    mut query: ExplorerQuery,
) -> Result<OverviewResult, ReadError> {
    let mut tx = begin(pool).await?;
    let sources = campaigns(&mut tx).await?;
    let Some((source, request_notices)) = query.resolve(&sources) else {
        tx.commit().await?;
        return Ok(OverviewResult::Empty);
    };
    // Each request discovers current publication first. Cached calculations only
    // reuse immutable releases and their captured provenance, never stale pointers.
    let cache_key = format!("{}:{}", source.campaign, serde_json::to_string(&sources)?);
    if let Some(mut overview) = cached_overview(&cache_key) {
        tx.commit().await?;
        overview.request_notices = request_notices;
        return Ok(OverviewResult::Ready {
            data: Box::new(overview),
        });
    }
    let mut notices = Vec::new();
    // Transfer only the reviewed indicators. Raw admissions payloads never leave the API.
    let rows = sqlx::query("SELECT payload->>'cod_uai' AS establishment, payload->>'fili' AS type, payload->>'region_etab_aff' AS region, (SELECT jsonb_object_agg(key, value) FROM jsonb_each(payload) WHERE key = ANY($3)) AS metrics FROM raw_records WHERE release_id = $1::uuid AND campaign = $2 LIMIT 250001")
        .bind(&source.release_id).bind(source.campaign)
        .bind(FIELDS.iter().map(|(_, field, _, _)| *field).collect::<Vec<_>>())
        .persistent(false).fetch_all(&mut *tx).await?;
    if rows.len() > 250_000 {
        return Err(ReadError);
    }
    let mut totals = Totals::default();
    let mut establishments = BTreeSet::new();
    let mut by_type: BTreeMap<String, Breakdown> = BTreeMap::new();
    let mut by_region: BTreeMap<String, Breakdown> = BTreeMap::new();
    let mut coverage: BTreeMap<String, Coverage> = FIELDS
        .iter()
        .map(|(key, _, _, _)| {
            (
                key.to_string(),
                Coverage {
                    key: key.to_string(),
                    ..Default::default()
                },
            )
        })
        .collect();
    let mut distribution: Vec<_> = (0..5)
        .map(|i| AccessBucket {
            label: if i == 4 {
                "80–100 %".into()
            } else {
                format!("{}–{} %", i * 20, (i + 1) * 20)
            },
            min: i * 20,
            max: (i + 1) * 20,
            count: 0,
        })
        .collect();
    for row in rows {
        let values = metrics(
            &row.try_get::<Option<Value>, _>("metrics")?
                .unwrap_or(Value::Null),
        );
        totals.formations += 1;
        totals.capacity.push(&values["capacity"]);
        totals.applications.push(&values["applications"]);
        totals.admitted.push(&values["admitted"]);
        if let Some(id) = row
            .try_get::<Option<String>, _>("establishment")?
            .filter(|s| !s.trim().is_empty())
        {
            establishments.insert(id);
        }
        for (map, field) in [(&mut by_type, "type"), (&mut by_region, "region")] {
            let label = row
                .try_get::<Option<String>, _>(field)?
                .filter(|s| !s.trim().is_empty())
                .unwrap_or_else(|| "Non renseigné".into());
            map.entry(label.clone())
                .or_insert_with(|| Breakdown {
                    label,
                    ..Default::default()
                })
                .push(&values);
        }
        for (key, value) in &values {
            let entry = coverage.get_mut(key).ok_or(ReadError)?;
            match value.state {
                ValueState::Observed => entry.observed += 1,
                ValueState::Missing => entry.missing += 1,
                ValueState::Suppressed => entry.suppressed += 1,
                ValueState::Invalid => entry.invalid += 1,
            }
        }
        if let Some(access) = values["accessRate"].value {
            distribution[((access / 20.0) as usize).min(4)].count += 1;
        }
    }
    totals.establishments = establishments.len();
    let history = campaign_history(&mut tx, &sources).await?;
    notices.push("Les candidatures et les admis sont additionnés par ligne de formation publiée. Les candidatures ne représentent pas des personnes uniques ; les doublons de la source sont conservés.".into());
    notices.push("Les sommes portent sur les valeurs observées. Leur couverture est indiquée ; les valeurs absentes, masquées ou invalides sont exclues, jamais remplacées par zéro.".into());
    notices.push("Hors apprentissage. Les campagnes sont des photographies distinctes : offre de formations et définitions peuvent évoluer. APB est exclu des séries Parcoursup.".into());
    tx.commit().await?;
    let sorted = |map: BTreeMap<String, Breakdown>| {
        let mut values: Vec<_> = map.into_values().collect();
        values.sort_by(|a, b| b.formations.cmp(&a.formations).then(a.label.cmp(&b.label)));
        values
    };
    let mut overview = Overview {
        source,
        campaigns: sources.iter().map(|s| s.campaign).collect(),
        totals,
        by_type: sorted(by_type),
        by_region: sorted(by_region),
        access_distribution: distribution,
        coverage: coverage.into_values().collect(),
        history,
        notices,
        request_notices: Vec::new(),
    };
    cache_overview(cache_key, &overview);
    overview.request_notices = request_notices;
    Ok(OverviewResult::Ready {
        data: Box::new(overview),
    })
}

async fn campaign_history(
    connection: &mut PgConnection,
    sources: &[CampaignSource],
) -> Result<Vec<CampaignObservation>, ReadError> {
    let key = serde_json::to_string(sources)?;
    if let Ok(entries) = HISTORIES.get_or_init(Mutex::default).lock()
        && let Some((_, history)) = entries.iter().find(|(existing, _)| existing == &key)
    {
        return Ok(history.clone());
    }
    let rows = sqlx::query(include_str!("history.sql"))
        .bind(
            sources
                .iter()
                .map(|s| s.release_id.as_str())
                .collect::<Vec<_>>(),
        )
        .bind(sources.iter().map(|s| s.campaign).collect::<Vec<_>>())
        .persistent(false)
        .fetch_all(connection)
        .await?;
    let history: Vec<CampaignObservation> = rows
        .into_iter()
        .map(|row| {
            let campaign: i32 = row.try_get("campaign")?;
            let source = sources
                .iter()
                .find(|s| s.campaign == campaign)
                .ok_or(ReadError)?
                .clone();
            let total = row.try_get::<i64, _>("formations")? as usize;
            Ok(CampaignObservation {
                source,
                campaign,
                formations: total,
                capacity: Total {
                    value: row.try_get("capacity")?,
                    observed: row.try_get::<i64, _>("capacity_observed")? as usize,
                    total,
                },
                admitted: Total {
                    value: row.try_get("admitted")?,
                    observed: row.try_get::<i64, _>("admitted_observed")? as usize,
                    total,
                },
            })
        })
        .collect::<Result<_, ReadError>>()?;
    if let Ok(mut entries) = HISTORIES.get_or_init(Mutex::default).lock() {
        entries.retain(|(existing, _)| existing != &key);
        while entries.len() >= 2 {
            entries.pop_front();
        }
        entries.push_back((key, history.clone()));
    }
    Ok(history)
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoryPoint {
    pub source: CampaignSource,
    pub campaign: i32,
    pub formation_id: Option<String>,
    pub metrics: Option<Metrics>,
    pub continuity: &'static str,
}
#[derive(Clone, Debug, Serialize)]
pub struct Detail {
    pub source: CampaignSource,
    pub formation: Formation,
    pub definitions: Vec<Definition>,
    pub history: Vec<HistoryPoint>,
    pub notices: Vec<String>,
}
#[derive(Clone, Debug, Serialize)]
#[serde(tag = "status", rename_all = "lowercase")]
pub enum DetailResult {
    Ready { data: Box<Detail> },
}

pub fn parse_record_id(id: &str) -> Option<(&str, i64)> {
    let (release, row) = id.split_once(':')?;
    if release.len() != 36
        || !release.bytes().enumerate().all(|(i, c)| {
            if [8, 13, 18, 23].contains(&i) {
                c == b'-'
            } else {
                c.is_ascii_hexdigit()
            }
        })
    {
        return None;
    }
    if row.is_empty() || row.starts_with('0') || !row.bytes().all(|byte| byte.is_ascii_digit()) {
        return None;
    }
    let row = row.parse::<i64>().ok().filter(|n| *n > 0)?;
    Some((release, row))
}

pub async fn detail(pool: &PgPool, id: &str) -> Result<Option<DetailResult>, ReadError> {
    let Some((release_id, row_number)) = parse_record_id(id) else {
        return Ok(None);
    };
    let mut tx = begin(pool).await?;
    let mut sources = campaigns(&mut tx).await?;
    let row = sqlx::query(include_str!("detail.sql"))
        .bind(release_id)
        .bind(row_number)
        .persistent(false)
        .fetch_optional(&mut *tx)
        .await?;
    let Some(row) = row else {
        return Ok(None);
    };
    let campaign: i32 = row.try_get("campaign")?;
    let source = match sources
        .iter()
        .find(|s| s.release_id == release_id && s.campaign == campaign)
    {
        Some(source) => source.clone(),
        None => {
            let Some(source) = release_campaigns(&mut tx, release_id)
                .await?
                .into_iter()
                .find(|s| s.campaign == campaign)
            else {
                return Ok(None);
            };
            source
        }
    };
    sources.retain(|s| s.campaign != source.campaign);
    sources.push(source.clone());
    let value: Value = row.try_get("formation")?;
    let payload = &value["raw_payload"];
    let establishment_id = payload["cod_uai"].as_str().filter(|s| !s.trim().is_empty());
    let formation =
        serde_json::from_value::<DescriptiveRow>(value.clone())?.formation(&source.release_id);
    let metadata: Value = row.try_get("metadata")?;
    sources.sort_by_key(|s| s.campaign);
    // At most two candidates per source; duplicate identities remain ambiguous.
    let candidates = if let (Some(formation_id), Some(establishment_id)) =
        (&formation.source_formation_id, establishment_id)
    {
        sqlx::query(include_str!("formation-history.sql"))
            .bind(
                sources
                    .iter()
                    .map(|s| s.release_id.as_str())
                    .collect::<Vec<_>>(),
            )
            .bind(sources.iter().map(|s| s.campaign).collect::<Vec<_>>())
            .bind(formation_id)
            .bind(establishment_id)
            .persistent(false)
            .fetch_all(&mut *tx)
            .await?
    } else {
        Vec::new()
    };
    let mut history = Vec::new();
    for historical_source in sources {
        let mut point = HistoryPoint {
            campaign: historical_source.campaign,
            source: historical_source.clone(),
            formation_id: None,
            metrics: None,
            continuity: "missing",
        };
        let matching: Vec<_> = candidates
            .iter()
            .filter(|candidate| candidate.get::<i32, _>("campaign") == historical_source.campaign)
            .collect();
        match matching.as_slice() {
            [candidate] => {
                let previous: Value = candidate.try_get("payload")?;
                let same_description = [
                    "lib_for_voe_ins",
                    "form_lib_voe_acc",
                    "fil_lib_voe_acc",
                    "detail_forma",
                    "fili",
                    "g_ea_lib_vx",
                ]
                .iter()
                .all(|field| previous.get(field) == payload.get(field));
                point.continuity = if same_description {
                    "same-source-identity"
                } else {
                    "changed-description"
                };
                point.formation_id = Some(format!(
                    "{}:{}",
                    historical_source.release_id,
                    candidate.try_get::<i64, _>("row_number")?
                ));
                point.metrics = Some(metrics(&previous));
            }
            [] => {}
            _ => point.continuity = "ambiguous",
        }
        history.push(point);
    }
    tx.commit().await?;
    Ok(Some(DetailResult::Ready { data: Box::new(Detail { source, formation, definitions: definitions(&metadata), history, notices: vec!["Le taux d’accès est celui publié par le MESR pour la phase principale. Il ne prédit pas une admission individuelle.".into(), "L’historique rapproche uniquement le même identifiant Parcoursup et le même établissement. Un changement de description est signalé ; ce rapprochement ne prouve pas une formation inchangée. Les doublons restent sans valeur historique agrégée.".into()] }) }))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn aggregate_reports_partial_coverage_and_never_imputes() {
        let mut total = Total::default();
        total.push(&MetricValue::parse("n", Some("ns"), false));
        assert_eq!(total.value, None);
        total.push(&MetricValue::parse("n", Some("0"), false));
        total.push(&MetricValue::parse("n", Some("12"), false));
        assert_eq!(total.value, Some(12.0));
        assert_eq!((total.observed, total.total), (2, 3));
    }
    #[test]
    fn row_ids_are_validated_before_sql_casts() {
        assert!(parse_record_id("f47ac10b-58cc-4372-a567-0e02b2c3d479:12").is_some());
        for id in [
            "bad:1",
            "f47ac10b-58cc-4372-a567-0e02b2c3d479:0",
            "f47ac10b-58cc-4372-a567-0e02b2c3d479:-1",
            "' OR 1=1",
        ] {
            assert!(parse_record_id(id).is_none());
        }
    }
}
