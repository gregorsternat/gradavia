use orvio_core::metrics::MetricValue;
use serde::Serialize;
use serde_json::Value;
use std::collections::BTreeMap;

pub type Metrics = BTreeMap<String, MetricValue>;

pub const FIELDS: [(&str, &str, bool, &str); 10] = [
    ("capacity", "capa_fin", false, "Places proposées"),
    (
        "applications",
        "voe_tot",
        false,
        "Candidatures à la formation",
    ),
    ("offers", "prop_tot", false, "Propositions d’admission"),
    ("admitted", "acc_tot", false, "Candidats ayant accepté"),
    (
        "accessRate",
        "taux_acces_ens",
        true,
        "Taux d’accès officiel",
    ),
    ("femaleShare", "pct_f", true, "Part des admises"),
    (
        "scholarshipShare",
        "pct_bours",
        true,
        "Boursiers parmi les néo-bacheliers admis",
    ),
    (
        "generalBacShare",
        "pct_bg",
        true,
        "Bac général parmi les néo-bacheliers admis",
    ),
    (
        "technologyBacShare",
        "pct_bt",
        true,
        "Bac technologique parmi les néo-bacheliers admis",
    ),
    (
        "vocationalBacShare",
        "pct_bp",
        true,
        "Bac professionnel parmi les néo-bacheliers admis",
    ),
];

pub fn metrics(payload: &Value) -> Metrics {
    FIELDS
        .iter()
        .map(|(key, field, percentage, _)| {
            let raw = match payload.get(field) {
                None | Some(Value::Null) => None,
                Some(Value::String(value)) => Some(value.clone()),
                Some(value) => Some(value.to_string()),
            };
            (
                key.to_string(),
                MetricValue::parse(field, raw.as_deref(), *percentage),
            )
        })
        .collect()
}

#[derive(Clone, Debug, Serialize)]
pub struct Definition {
    pub key: String,
    pub field: String,
    pub label: String,
    pub unit: &'static str,
    pub description: String,
}

pub fn definitions(metadata: &Value) -> Vec<Definition> {
    FIELDS.iter().map(|(key, field, percentage, label)| {
        let definition = metadata["fields"].as_array().and_then(|fields| fields.iter().find(|f| f["name"] == *field));
        let source_label = definition.and_then(|d| d["label"].as_str()).unwrap_or(label);
        let description = match *key {
            "accessRate" => "Part des candidats dont le rang est inférieur ou égal au dernier appelé de leur groupe, parmi ceux ayant validé un vœu en phase principale. Valeur publiée par le MESR ; ce n’est pas une probabilité individuelle d’admission.",
            "applications" => "Nombre de candidats à cette formation, toutes phases. Une même personne peut candidater à plusieurs formations : les sommes sont des candidatures, jamais des personnes uniques.",
            "offers" => "Candidats ayant reçu une proposition de cette formation, toutes phases. Un candidat peut recevoir plusieurs propositions de formations différentes.",
            "admitted" => "Candidats ayant accepté une proposition de cette formation, toutes phases, selon le périmètre de la campagne publiée.",
            "capacity" => "Capacité publiée pour la formation et la campagne. Elle ne mesure pas le nombre de places encore disponibles.",
            "femaleShare" => "Part des femmes parmi l’ensemble des admis, telle que publiée par la source.",
            _ => "Part publiée parmi les néo-bacheliers admis. Ce dénominateur n’inclut pas l’ensemble des admis, notamment les candidats en réorientation.",
        };
        Definition { key: key.to_string(), field: field.to_string(), label: source_label.to_string(), unit: if *percentage { "percent" } else { "count" }, description: definition.and_then(|d| d["description"].as_str()).filter(|d| !d.trim().is_empty()).map(|d| format!("{d}. {description}")).unwrap_or_else(|| description.to_string()) }
    }).collect()
}
