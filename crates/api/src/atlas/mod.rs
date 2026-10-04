//! Bounded, immutable snapshots for linked exploration. Source families stay separate.
use crate::{
    analytics::{
        metrics::{Definition, FIELDS, Metrics},
        repository::{Coverage, parse_record_id},
    },
    formations::{
        domain::{CampaignSource, MAX_QUERY_BYTES, source_text},
        repository::{ReadError, decode_campaigns},
    },
};
use gradavia_core::metrics::{MetricValue, ValueState};
use serde::Serialize;
use serde_json::Value;
use sqlx::{PgConnection, PgPool, Row};
use std::{
    collections::{BTreeMap, VecDeque},
    sync::{Mutex, OnceLock},
};

const LIMIT: usize = 30_000;
const SNAPSHOT_FIELDS: [&str; 25] = [
    "cod_aff_form",
    "cod_uai",
    "lib_for_voe_ins",
    "form_lib_voe_acc",
    "fil_lib_voe_acc",
    "detail_forma",
    "g_ea_lib_vx",
    "ville_etab",
    "dep_lib",
    "lib_dep",
    "region_etab_aff",
    "lib_reg",
    "fili",
    "contrat_etab",
    "select_form",
    "g_olocalisation_des_formations",
    "capa_fin",
    "voe_tot",
    "prop_tot",
    "acc_tot",
    "pct_f",
    "pct_bours",
    "pct_bg",
    "pct_bt",
    "pct_bp",
];
const SOURCE_IDS: [&str; 10] = [
    "fr-esr-parcoursup-2018",
    "fr-esr-parcoursup-2019",
    "fr-esr-parcoursup_2020",
    "fr-esr-parcoursup_2021",
    "fr-esr-parcoursup_2022",
    "fr-esr-parcoursup_2023",
    "fr-esr-parcoursup_2024",
    "fr-esr-parcoursup",
    "fr-esr-parcoursup-apprentissage",
    "fr-esr-apb_voeux-et-admissions",
];

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Family {
    Parcoursup,
    Apprentissage,
    Apb,
}
impl Family {
    fn source_family(self) -> &'static str {
        match self {
            Self::Parcoursup => "parcoursup",
            Self::Apprentissage => "apprenticeship",
            Self::Apb => "apb",
        }
    }
    fn from_dataset(id: &str) -> Option<Self> {
        if !SOURCE_IDS.contains(&id) {
            return None;
        }
        Some(match id {
            "fr-esr-apb_voeux-et-admissions" => Self::Apb,
            "fr-esr-parcoursup-apprentissage" => Self::Apprentissage,
            _ => Self::Parcoursup,
        })
    }
}
#[derive(Debug)]
pub struct Query {
    family: Family,
    campaign: Option<i32>,
    version: Option<String>,
}
impl Query {
    pub fn parse(raw: &str) -> Result<Self, &'static str> {
        if raw.len() > MAX_QUERY_BYTES {
            return Err("Query too large");
        }
        let pairs: Vec<_> = url::form_urlencoded::parse(raw.as_bytes()).collect();
        let value = |name| {
            pairs
                .iter()
                .find(|(key, _)| key == name)
                .map(|(_, v)| v.trim())
        };
        let family = match value("famille") {
            Some("apprentissage") => Family::Apprentissage,
            Some("apb") => Family::Apb,
            None | Some("parcoursup") | Some("") => Family::Parcoursup,
            _ => return Err("Unknown family"),
        };
        let campaign = match value("campagne") {
            None | Some("") => None,
            Some(v) if v.len() == 4 && v.bytes().all(|c| c.is_ascii_digit()) => {
                Some(v.parse().map_err(|_| "Invalid campaign")?)
            }
            _ => return Err("Invalid campaign"),
        };
        let version = match value("version") {
            None | Some("") => None,
            Some(v) if parse_record_id(&format!("{v}:1")).is_some() => Some(v.to_owned()),
            _ => return Err("Invalid version"),
        };
        Ok(Self {
            family,
            campaign,
            version,
        })
    }
}
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Item {
    pub id: String,
    pub source_formation_id: Option<String>,
    pub establishment_id: Option<String>,
    pub title: String,
    pub establishment: Option<String>,
    pub city: Option<String>,
    pub department: Option<String>,
    pub region: Option<String>,
    pub r#type: Option<String>,
    pub status: Option<String>,
    pub selectivity: Option<String>,
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
    pub metrics: BTreeMap<String, Option<f64>>,
    pub states: BTreeMap<String, ValueState>,
}
#[derive(Clone, Serialize)]
pub struct Snapshot {
    source: CampaignSource,
    campaigns: Vec<i32>,
    family: Family,
    items: Vec<Item>,
    definitions: Vec<Definition>,
    coverage: Vec<Coverage>,
    notices: Vec<String>,
}
#[derive(Serialize)]
#[serde(tag = "status", rename_all = "lowercase")]
pub enum SnapshotResult {
    Ready { data: Box<Snapshot> },
    Empty,
}
#[derive(Clone, Debug, Serialize)]
pub struct RankGroup {
    label: Option<String>,
    field: String,
    rank: MetricValue,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct History {
    source: CampaignSource,
    campaign: i32,
    formation_id: Option<String>,
    continuity: &'static str,
    metrics: Option<Metrics>,
    rank_groups: Vec<RankGroup>,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Detail {
    source: CampaignSource,
    family: Family,
    item: Item,
    metrics: Metrics,
    definitions: Vec<Definition>,
    rank_groups: Vec<RankGroup>,
    history: Vec<History>,
    notices: Vec<String>,
}
#[derive(Serialize)]
#[serde(tag = "status", rename_all = "lowercase")]
pub enum DetailResult {
    Ready { data: Box<Detail> },
}

async fn sources(
    connection: &mut PgConnection,
    family: Family,
    version: Option<&str>,
) -> Result<Vec<CampaignSource>, ReadError> {
    let rows = sqlx::query("SELECT r.id::text AS release_id, d.id AS dataset_id, r.campaigns, to_char(r.collected_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"') AS collected_at, to_char(r.source_modified_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"') AS modified_at, r.license, coalesce(nullif(btrim(r.metadata #>> '{metas,default,publisher}'), ''), d.provider) AS provider, (SELECT jsonb_agg(f->>'name') FROM jsonb_array_elements(r.metadata->'fields') f) AS fields FROM source_datasets d JOIN source_releases r ON r.dataset_id = d.id WHERE d.family = $1 AND d.id = ANY($2) AND (($3::text IS NULL AND r.id = d.current_release_id) OR r.id::text = lower($3)) ORDER BY d.id")
        .bind(family.source_family()).bind(SOURCE_IDS.as_slice()).bind(version).persistent(false).fetch_all(connection).await?;
    decode_campaigns(rows)
}
fn text(payload: &Value, field: &str) -> Option<String> {
    source_text(payload[field].as_str().map(str::to_owned))
}
fn parse(payload: &Value, field: &str, percentage: bool) -> MetricValue {
    let raw = payload.get(field).filter(|v| !v.is_null()).map(|v| {
        v.as_str()
            .map(str::to_owned)
            .unwrap_or_else(|| v.to_string())
    });
    MetricValue::parse(field, raw.as_deref(), percentage)
}
fn field_for(family: Family, key: &str, field: &'static str) -> &'static str {
    if family == Family::Apb {
        match key {
            "scholarshipShare" => "p_acc_boursier",
            "localShare" => "p_acc_academies",
            _ => field,
        }
    } else {
        field
    }
}
fn snapshot_definitions(family: Family) -> Vec<Definition> {
    FIELDS.iter().copied().chain(std::iter::once(("localShare", "pct_aca_orig", true, "Recrutement dans l’académie"))).map(|(key,field,percentage,label)| {
        let description = match key { "accessRate" => "Taux publié en phase principale. Ne représente pas une probabilité individuelle d’admission.", "applications" => "Candidatures à une formation, toutes phases. Les sommes ne comptent pas des personnes uniques.", "offers" => "Candidats ayant reçu une proposition de cette formation, dans le périmètre propre à la source.", "admitted" => "Candidats ayant accepté une proposition dans le périmètre de cette source ; non publié dans le jeu apprentissage.", "capacity" => "Capacité publiée ; ne correspond pas aux places actuellement disponibles.", "femaleShare" => "Part publiée des femmes parmi les admis. Non reconstruite à partir d’autres champs.", "localShare" if family == Family::Apb => "Part publiée des admis dans leur académie d’origine ; périmètre APB.", "localShare" => "Part publiée des admis néo-bacheliers issus de la même académie. Paris, Créteil et Versailles ne sont pas regroupées dans ce champ.", "scholarshipShare" if family == Family::Apb => "Part publiée des boursiers parmi les admis APB, distincte du dénominateur néo-bacheliers de Parcoursup.", _ => "Part publiée parmi les néo-bacheliers admis ; dénominateur distinct de l’ensemble des admis." };
        Definition { key:key.into(), field:field_for(family,key,field).into(), label:label.into(), unit:if percentage {"percent"} else {"count"}, description:description.into() }
    }).collect()
}
fn values(payload: &Value, definitions: &[Definition]) -> Metrics {
    definitions
        .iter()
        .map(|d| (d.key.clone(), parse(payload, &d.field, d.unit == "percent")))
        .collect()
}
fn coordinates(payload: &Value) -> (Option<f64>, Option<f64>) {
    let geo = &payload["g_olocalisation_des_formations"];
    // The regular source publishes a geo object; apprenticeship publishes "lat, lon" text.
    let pair = if let Some(raw) = geo.as_str() {
        raw.split_once(',').and_then(|(lat, lon)| {
            Some((
                lat.trim().parse::<f64>().ok()?,
                lon.trim().parse::<f64>().ok()?,
            ))
        })
    } else {
        geo["lat"].as_f64().zip(geo["lon"].as_f64())
    };
    match pair {
        Some((lat, lon))
            if lat.is_finite()
                && lon.is_finite()
                && (-90.0..=90.0).contains(&lat)
                && (-180.0..=180.0).contains(&lon) =>
        {
            (Some(lat), Some(lon))
        }
        _ => (None, None),
    }
}

fn item(
    payload: &Value,
    source: &CampaignSource,
    row: i64,
    family: Family,
    defs: &[Definition],
) -> Item {
    let title = text(payload, "lib_for_voe_ins").unwrap_or_else(|| {
        let mut parts = Vec::new();
        for field in ["form_lib_voe_acc", "fil_lib_voe_acc", "detail_forma"] {
            if let Some(value) = text(payload, field)
                && !parts.contains(&value)
            {
                parts.push(value);
            }
        }
        if parts.is_empty() {
            "Intitulé non renseigné".into()
        } else {
            parts.join(" — ")
        }
    });
    let metrics = values(payload, defs);
    let (latitude, longitude) = if family == Family::Apb {
        (None, None)
    } else {
        coordinates(payload)
    };
    let selectivity = text(payload, "select_form").map(|v| match v.as_str() {
        "formation selective" | "formation sélective" => "Sélective".into(),
        "formation non selec" | "formation non sélective" => "Non sélective".into(),
        _ => v,
    });
    Item {
        id: format!("{}:{row}", source.release_id),
        source_formation_id: if family == Family::Apb {
            None
        } else {
            text(payload, "cod_aff_form")
        },
        establishment_id: text(payload, "cod_uai"),
        title,
        establishment: text(payload, "g_ea_lib_vx"),
        city: text(payload, "ville_etab"),
        department: text(
            payload,
            if family == Family::Apb {
                "lib_dep"
            } else {
                "dep_lib"
            },
        ),
        region: text(
            payload,
            if family == Family::Apb {
                "lib_reg"
            } else {
                "region_etab_aff"
            },
        ),
        r#type: text(payload, "fili"),
        status: text(payload, "contrat_etab"),
        selectivity,
        latitude,
        longitude,
        metrics: metrics.iter().map(|(k, v)| (k.clone(), v.value)).collect(),
        states: metrics
            .iter()
            .filter(|(_, v)| v.state != ValueState::Observed)
            .map(|(k, v)| (k.clone(), v.state))
            .collect(),
    }
}
fn notices(family: Family) -> Vec<String> {
    let scope = match family {
        Family::Parcoursup => {
            "Parcoursup hors apprentissage. Les candidatures cumulées ne représentent pas des personnes uniques."
        }
        Family::Apprentissage => {
            "L’apprentissage relève d’un jeu distinct. Les propositions dépendent notamment de la recherche d’un contrat ; admissions et taux d’accès ne sont pas publiés ici."
        }
        Family::Apb => {
            "Archives APB 2016–2017 : vœux hiérarchisés et périmètre propre. Aucune continuité automatique avec Parcoursup."
        }
    };
    vec![scope.into(),"Les valeurs absentes, masquées et invalides restent distinctes de zéro. Les coordonnées proviennent de la source ; les distances éventuelles sont à vol d’oiseau.".into(),"Une version désigne un instantané immuable. Des identifiants identiques entre campagnes ne prouvent pas une formation inchangée.".into()]
}
static SNAPSHOTS: OnceLock<Mutex<VecDeque<(String, Snapshot)>>> = OnceLock::new();
fn cached(key: &str) -> Option<Snapshot> {
    let mut entries = SNAPSHOTS.get_or_init(Mutex::default).lock().ok()?;
    let index = entries.iter().position(|(k, _)| k == key)?;
    let entry = entries.remove(index)?;
    let snapshot = entry.1.clone();
    entries.push_back(entry);
    Some(snapshot)
}
fn cache(key: String, snapshot: &Snapshot) {
    if let Ok(mut entries) = SNAPSHOTS.get_or_init(Mutex::default).lock() {
        entries.retain(|(k, _)| *k != key);
        while entries.len() >= 4
            || entries
                .iter()
                .map(|(_, entry)| entry.items.len())
                .sum::<usize>()
                + snapshot.items.len()
                > 60_000
        {
            entries.pop_front();
        }
        entries.push_back((key, snapshot.clone()));
    }
}

pub async fn snapshot(pool: &PgPool, query: Query) -> Result<Option<SnapshotResult>, ReadError> {
    let mut tx = pool.begin().await?;
    sqlx::raw_sql("SET TRANSACTION READ ONLY; SET LOCAL statement_timeout = '8s'")
        .execute(&mut *tx)
        .await?;
    let current = sources(&mut tx, query.family, None).await?;
    let available = if let Some(version) = query.version.as_deref() {
        sources(&mut tx, query.family, Some(version)).await?
    } else {
        current.clone()
    };
    let source = available
        .iter()
        .find(|s| query.campaign == Some(s.campaign))
        .or_else(|| {
            if query.campaign.is_none() {
                available.first()
            } else {
                None
            }
        })
        .cloned();
    let Some(source) = source else {
        tx.commit().await?;
        return Ok(if query.version.is_some() || query.campaign.is_some() {
            None
        } else {
            Some(SnapshotResult::Empty)
        });
    };
    // Publication pointers are captured before each lookup; only immutable rows are cached.
    let cache_key = format!(
        "{:?}:{}:{}",
        query.family,
        serde_json::to_string(&source)?,
        serde_json::to_string(&current)?
    );
    if let Some(data) = cached(&cache_key) {
        tx.commit().await?;
        return Ok(Some(SnapshotResult::Ready {
            data: Box::new(data),
        }));
    }
    let definitions = snapshot_definitions(query.family);
    let projection: Vec<_> = SNAPSHOT_FIELDS
        .into_iter()
        .chain(definitions.iter().map(|d| d.field.as_str()))
        .collect();
    let rows=sqlx::query("SELECT row_number, (SELECT jsonb_object_agg(key,value) FROM jsonb_each(payload) WHERE key = ANY($3)) AS payload FROM raw_records WHERE release_id=$1::uuid AND campaign=$2 ORDER BY row_number LIMIT 30001")
        .bind(&source.release_id).bind(source.campaign).bind(projection).persistent(false).fetch_all(&mut *tx).await?;
    if rows.len() > LIMIT {
        return Err(ReadError);
    }
    let items: Vec<_> = rows
        .iter()
        .map(|r| {
            Ok(item(
                &r.try_get::<Value, _>("payload")?,
                &source,
                r.try_get("row_number")?,
                query.family,
                &definitions,
            ))
        })
        .collect::<Result<_, ReadError>>()?;
    let coverage = definitions
        .iter()
        .map(|d| {
            let mut c = Coverage {
                key: d.key.clone(),
                ..Default::default()
            };
            for row in &items {
                match row.states.get(&d.key) {
                    None => c.observed += 1,
                    Some(ValueState::Missing) => c.missing += 1,
                    Some(ValueState::Suppressed) => c.suppressed += 1,
                    Some(ValueState::Invalid) => c.invalid += 1,
                    Some(ValueState::Observed) => unreachable!(),
                }
            }
            c
        })
        .collect();
    let mut campaigns: Vec<_> = current
        .iter()
        .map(|s| s.campaign)
        .chain(std::iter::once(source.campaign))
        .collect();
    campaigns.sort_by(|a, b| b.cmp(a));
    campaigns.dedup();
    tx.commit().await?;
    let data = Snapshot {
        source,
        campaigns,
        family: query.family,
        items,
        definitions,
        coverage,
        notices: notices(query.family),
    };
    cache(cache_key, &data);
    Ok(Some(SnapshotResult::Ready {
        data: Box::new(data),
    }))
}

const DETAIL_FIELDS: [(&str, &str, bool, &str, &str); 32] = [
    (
        "femaleApplications",
        "voe_tot_f",
        false,
        "Candidates",
        "Femmes candidates à cette formation, toutes phases.",
    ),
    (
        "femaleAdmitted",
        "acc_tot_f",
        false,
        "Admises",
        "Femmes ayant accepté une proposition de cette formation.",
    ),
    (
        "neoBacAdmitted",
        "acc_neobac",
        false,
        "Néo-bacheliers admis",
        "Admis ayant obtenu leur baccalauréat lors de la campagne.",
    ),
    (
        "generalAdmitted",
        "acc_bg",
        false,
        "Bac général · admis",
        "Néo-bacheliers généraux admis, toutes phases.",
    ),
    (
        "technologyAdmitted",
        "acc_bt",
        false,
        "Bac technologique · admis",
        "Néo-bacheliers technologiques admis, toutes phases.",
    ),
    (
        "vocationalAdmitted",
        "acc_bp",
        false,
        "Bac professionnel · admis",
        "Néo-bacheliers professionnels admis, toutes phases.",
    ),
    (
        "otherAdmitted",
        "acc_at",
        false,
        "Autres admis",
        "Autres candidats admis, toutes phases.",
    ),
    (
        "scholarshipAdmitted",
        "acc_brs",
        false,
        "Néo-bacheliers boursiers admis",
        "Effectif publié des boursiers néo-bacheliers admis.",
    ),
    (
        "localAdmitted",
        "acc_aca_orig",
        false,
        "Admis de la même académie",
        "Effectif publié des admis issus de la même académie. Utiliser la part officielle pour le pourcentage des néo-bacheliers.",
    ),
    (
        "localIdfShare",
        "pct_aca_orig_idf",
        true,
        "Recrutement local · académies franciliennes réunies",
        "Part publiée des admis néo-bacheliers de la même académie, Paris, Créteil et Versailles réunies.",
    ),
    (
        "sameSchoolShare",
        "pct_etab_orig",
        true,
        "Recrutement dans le même établissement",
        "Part publiée des néo-bacheliers admis dans leur établissement d’origine, pour les BTS et CPGE.",
    ),
    (
        "mentionUnknown",
        "acc_mention_nonrenseignee",
        false,
        "Mention non renseignée",
        "Néo-bacheliers admis sans information publiée sur leur mention au baccalauréat.",
    ),
    (
        "mentionNone",
        "acc_sansmention",
        false,
        "Sans mention",
        "Néo-bacheliers admis sans mention au baccalauréat.",
    ),
    (
        "mentionFair",
        "acc_ab",
        false,
        "Assez bien",
        "Néo-bacheliers admis avec mention assez bien.",
    ),
    (
        "mentionGood",
        "acc_b",
        false,
        "Bien",
        "Néo-bacheliers admis avec mention bien.",
    ),
    (
        "mentionVeryGood",
        "acc_tb",
        false,
        "Très bien",
        "Effectif publié des néo-bacheliers admis avec mention très bien.",
    ),
    (
        "mentionHighest",
        "acc_tbf",
        false,
        "Très bien avec félicitations",
        "Effectif publié des néo-bacheliers admis avec félicitations du jury. Respecter le découpage de la campagne.",
    ),
    (
        "admittedAtOpening",
        "acc_debutpp",
        false,
        "Proposition reçue à l’ouverture",
        "Parmi les admis finaux, effectif ayant reçu sa proposition à l’ouverture de la phase principale. Il ne s’agit pas du nombre d’admissions enregistrées à cette date.",
    ),
    (
        "admittedBeforeBac",
        "acc_datebac",
        false,
        "Proposition reçue avant le bac",
        "Parmi les admis finaux, effectif ayant reçu sa proposition avant le baccalauréat. Jalon cumulé publié, pas une série quotidienne.",
    ),
    (
        "admittedBeforeEnd",
        "acc_finpp",
        false,
        "Proposition reçue avant la fin de la phase principale",
        "Parmi les admis finaux, effectif ayant reçu sa proposition avant la fin de la phase principale. Les jalons ne doivent pas être additionnés.",
    ),
    (
        "mainPhaseApplications",
        "nb_voe_pp",
        false,
        "Candidatures en phase principale",
        "Candidats en phase principale uniquement ; les propositions et admis publiés couvrent toutes les phases.",
    ),
    (
        "generalApplications",
        "nb_voe_pp_bg",
        false,
        "Bac général · candidatures en phase principale",
        "Candidats néo-bacheliers généraux en phase principale. Population distincte des propositions toutes phases.",
    ),
    (
        "technologyApplications",
        "nb_voe_pp_bt",
        false,
        "Bac technologique · candidatures en phase principale",
        "Candidats néo-bacheliers technologiques en phase principale. Population distincte des propositions toutes phases.",
    ),
    (
        "vocationalApplications",
        "nb_voe_pp_bp",
        false,
        "Bac professionnel · candidatures en phase principale",
        "Candidats néo-bacheliers professionnels en phase principale. Population distincte des propositions toutes phases.",
    ),
    (
        "otherApplications",
        "nb_voe_pp_at",
        false,
        "Autres candidatures en phase principale",
        "Autres candidats en phase principale.",
    ),
    (
        "generalOffers",
        "prop_tot_bg",
        false,
        "Bac général · propositions",
        "Candidats en terminale générale ayant reçu une proposition, toutes phases.",
    ),
    (
        "technologyOffers",
        "prop_tot_bt",
        false,
        "Bac technologique · propositions",
        "Candidats en terminale technologique ayant reçu une proposition, toutes phases.",
    ),
    (
        "vocationalOffers",
        "prop_tot_bp",
        false,
        "Bac professionnel · propositions",
        "Candidats en terminale professionnelle ayant reçu une proposition, toutes phases.",
    ),
    (
        "otherOffers",
        "prop_tot_at",
        false,
        "Autres propositions",
        "Autres candidats ayant reçu une proposition, toutes phases.",
    ),
    (
        "contractSearch",
        "nb_rech_con",
        false,
        "En recherche de contrat",
        "Vœux placés en recherche de contrat par la formation en apprentissage ; ce statut ne représente pas une admission.",
    ),
    (
        "rejectedApplication",
        "nb_ref_classe",
        false,
        "Refus après examen du dossier",
        "Vœux refusés par la formation en apprentissage après examen des dossiers.",
    ),
    (
        "rejectedCapacity",
        "nb_ref_place",
        false,
        "Refus faute de places",
        "Vœux refusés par la formation en apprentissage faute de places disponibles.",
    ),
];
fn detail_definitions(family: Family) -> Vec<Definition> {
    let mut defs = snapshot_definitions(family);
    defs.extend(DETAIL_FIELDS.iter().map(|(key,field,percent,label,description)| {
        let (field,label,description)=match (family,*key) {
            (Family::Apb,"scholarshipAdmitted") => ("acc_boursier","Boursiers admis","Admis boursiers APB ; ce champ n’est pas limité aux néo-bacheliers comme le champ Parcoursup."),
            (Family::Apb,"localAdmitted") => ("acc_academies",*label,"Candidats admis dans leur académie d’origine, périmètre APB."),
            (Family::Apb,"sameSchoolShare") => ("p_acc_term",*label,"Part des admis dans leur établissement d’origine, périmètre APB BTS/CPGE."),
            (Family::Apb,"mentionNone") => ("acc_passable",*label,"Candidats admis sans mention au baccalauréat, périmètre APB."),
            (Family::Apb,"mentionFair") => ("acc_assez_bien",*label,"Candidats admis avec mention assez bien, périmètre APB."),
            (Family::Apb,"mentionGood") => ("acc_bien",*label,"Candidats admis avec mention bien, périmètre APB."),
            (Family::Apb,"mentionVeryGood") => ("acc_tres_bien",*label,"Candidats admis avec mention très bien, périmètre APB."),
            (Family::Apprentissage,"generalApplications") => ("nb_voe_ap_bg","Bac général · candidatures","Candidats néo-bacheliers généraux, périmètre du jeu apprentissage."),
            (Family::Apprentissage,"technologyApplications") => ("nb_voe_ap_bt","Bac technologique · candidatures","Candidats néo-bacheliers technologiques, périmètre du jeu apprentissage."),
            (Family::Apprentissage,"vocationalApplications") => ("nb_voe_ap_bp","Bac professionnel · candidatures","Candidats néo-bacheliers professionnels, périmètre du jeu apprentissage."),
            (Family::Apprentissage,"otherApplications") => ("nb_voe_ap_at","Autres candidatures","Autres candidats, périmètre du jeu apprentissage."),
            _ => (*field,*label,*description),
        };
        Definition{key:(*key).into(),field:field.into(),label:label.into(),unit:if *percent {"percent"} else {"count"},description:description.into()}
    }));
    defs
}
fn ranks(payload: &Value) -> Vec<RankGroup> {
    let mut groups = Vec::new();
    for i in 1..=3 {
        let field = format!("ran_grp{i}");
        let rank = parse(payload, &field, false);
        let label = text(payload, &format!("lib_grp{i}"));
        if label.is_some() || rank.state != ValueState::Missing {
            groups.push(RankGroup { label, field, rank });
        }
    }
    if groups.is_empty() && payload.get("rang_der_max").is_some() {
        groups.push(RankGroup {
            label: Some("Rang maximal publié, sans groupe détaillé".into()),
            field: "rang_der_max".into(),
            rank: parse(payload, "rang_der_max", false),
        });
    }
    groups
}
pub async fn detail(pool: &PgPool, id: &str) -> Result<Option<DetailResult>, ReadError> {
    let Some((release, row_number)) = parse_record_id(id) else {
        return Ok(None);
    };
    let mut tx = pool.begin().await?;
    sqlx::raw_sql("SET TRANSACTION READ ONLY; SET LOCAL statement_timeout = '8s'")
        .execute(&mut *tx)
        .await?;
    let row=sqlx::query("SELECT rr.campaign,rr.payload,r.dataset_id FROM raw_records rr JOIN source_releases r ON r.id=rr.release_id WHERE rr.release_id=$1::uuid AND rr.row_number=$2 AND r.dataset_id=ANY($3)").bind(release).bind(row_number).bind(SOURCE_IDS.as_slice()).persistent(false).fetch_optional(&mut *tx).await?;
    let Some(row) = row else {
        return Ok(None);
    };
    let dataset: String = row.try_get("dataset_id")?;
    let Some(family) = Family::from_dataset(&dataset) else {
        return Ok(None);
    };
    let campaign: i32 = row.try_get("campaign")?;
    let Some(source) = sources(&mut tx, family, Some(release))
        .await?
        .into_iter()
        .find(|s| s.campaign == campaign)
    else {
        return Ok(None);
    };
    let payload: Value = row.try_get("payload")?;
    let snapshot_defs = snapshot_definitions(family);
    let item = item(&payload, &source, row_number, family, &snapshot_defs);
    let definitions = detail_definitions(family);
    let mut history = Vec::new();
    if let (Some(formation_id), Some(establishment_id)) =
        (&item.source_formation_id, &item.establishment_id)
    {
        let mut available = sources(&mut tx, family, None).await?;
        available.retain(|s| s.campaign != campaign);
        available.push(source.clone());
        available.sort_by_key(|s| s.campaign);
        let candidates = sqlx::query(include_str!("../analytics/formation-history.sql"))
            .bind(
                available
                    .iter()
                    .map(|s| s.release_id.as_str())
                    .collect::<Vec<_>>(),
            )
            .bind(available.iter().map(|s| s.campaign).collect::<Vec<_>>())
            .bind(formation_id)
            .bind(establishment_id)
            .persistent(false)
            .fetch_all(&mut *tx)
            .await?;
        for s in available {
            let matching: Vec<_> = candidates
                .iter()
                .filter(|c| c.get::<i32, _>("campaign") == s.campaign)
                .collect();
            let mut point = History {
                campaign: s.campaign,
                source: s.clone(),
                formation_id: None,
                continuity: "missing",
                metrics: None,
                rank_groups: Vec::new(),
            };
            match matching.as_slice() {
                [candidate] => {
                    let p: Value = candidate.try_get("payload")?;
                    point.continuity = if [
                        "lib_for_voe_ins",
                        "form_lib_voe_acc",
                        "fil_lib_voe_acc",
                        "detail_forma",
                        "fili",
                        "g_ea_lib_vx",
                    ]
                    .iter()
                    .all(|field| p.get(field) == payload.get(field))
                    {
                        "same-source-identity"
                    } else {
                        "changed-description"
                    };
                    point.formation_id = Some(format!(
                        "{}:{}",
                        s.release_id,
                        candidate.try_get::<i64, _>("row_number")?
                    ));
                    point.metrics = Some(values(&p, &definitions));
                    point.rank_groups = ranks(&p);
                }
                [] => {}
                _ => point.continuity = "ambiguous",
            };
            history.push(point);
        }
    }
    tx.commit().await?;
    let mut notices = notices(family);
    notices.push("Les mentions concernent les néo-bacheliers pour Parcoursup. Les jalons décrivent la réception des propositions des admis finaux, pas une courbe quotidienne des admissions. Les rangs sont propres à chaque groupe de classement.".into());
    Ok(Some(DetailResult::Ready {
        data: Box::new(Detail {
            source,
            family,
            item,
            metrics: values(&payload, &definitions),
            definitions,
            rank_groups: ranks(&payload),
            history,
            notices,
        }),
    }))
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    #[test]
    fn snapshot_preserves_states_and_rejects_partial_or_invalid_coordinates() {
        let defs = snapshot_definitions(Family::Parcoursup);
        let metrics = values(
            &json!({"capa_fin":0,"voe_tot":"<5","prop_tot":-1,"taux_acces_ens":101}),
            &defs,
        );
        assert_eq!(metrics["capacity"].value, Some(0.0));
        assert_eq!(metrics["applications"].state, ValueState::Suppressed);
        assert_eq!(metrics["offers"].state, ValueState::Invalid);
        assert_eq!(metrics["admitted"].state, ValueState::Missing);
        assert_eq!(metrics["accessRate"].state, ValueState::Invalid);
        assert_eq!(
            coordinates(&json!({"g_olocalisation_des_formations":{"lat":48.0,"lon":2.0}})),
            (Some(48.0), Some(2.0))
        );
        assert_eq!(
            coordinates(&json!({"g_olocalisation_des_formations": " -12.7981, 45.2862 "})),
            (Some(-12.7981), Some(45.2862))
        );
        for invalid in ["48,2,3", "lat,lon", "NaN,2", "91,2", "48"] {
            assert_eq!(
                coordinates(&json!({"g_olocalisation_des_formations":invalid})),
                (None, None)
            );
        }
        for p in [
            json!({"lat":91,"lon":2}),
            json!({"lat":48}),
            json!({"lat":"48","lon":2}),
            json!({"lat":48,"lon":181}),
        ] {
            assert_eq!(
                coordinates(&json!({"g_olocalisation_des_formations":p})),
                (None, None)
            );
        }
    }
    #[test]
    fn query_never_reinterprets_a_requested_version_or_family() {
        for q in [
            "famille=specialties",
            "version=invalid",
            "campagne=2025 OR 1=1",
        ] {
            assert!(Query::parse(q).is_err());
        }
        let q =
            Query::parse("famille=apb&campagne=2017&version=f47ac10b-58cc-4372-a567-0e02b2c3d479")
                .unwrap();
        assert_eq!(q.family, Family::Apb);
        assert_eq!(q.campaign, Some(2017));
        assert!(Query::parse(&"x".repeat(MAX_QUERY_BYTES + 1)).is_err());
    }
    #[test]
    fn source_adapters_preserve_distinct_populations() {
        let apb = values(
            &json!({"p_acc_boursier":"12.5","pct_bours":99,"acc_tot":"0"}),
            &snapshot_definitions(Family::Apb),
        );
        assert_eq!(apb["scholarshipShare"].value, Some(12.5));
        assert_eq!(apb["admitted"].value, Some(0.0));
        assert_eq!(apb["femaleShare"].state, ValueState::Missing);
        let apprenticeship = values(
            &json!({"nb_voe_ap_bg":12,"nb_voe_pp_bg":99}),
            &detail_definitions(Family::Apprentissage),
        );
        assert_eq!(apprenticeship["generalApplications"].value, Some(12.0));
        assert_eq!(apprenticeship["admitted"].state, ValueState::Missing);
        let group = ranks(
            &json!({"lib_grp1":"Bac général","ran_grp1":"ns","lib_grp2":"Bac technologique","ran_grp2":0}),
        );
        assert_eq!(group.len(), 2);
        assert_eq!(group[0].rank.state, ValueState::Suppressed);
        assert_eq!(group[1].rank.value, Some(0.0));
    }
}
