use serde::{Deserialize, Serialize};

pub const PAGE_SIZE: i32 = 25;
pub const MAX_QUERY_BYTES: usize = 16_384;

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ExplorerQuery {
    pub campagne: Option<i32>,
    pub q: String,
    pub page: i32,
    pub r#type: String,
    pub region: String,
    pub departement: String,
    pub statut: String,
    pub selectivite: String,
    pub tri: String,
}

impl ExplorerQuery {
    pub fn parse(raw: &str) -> Result<Self, &'static str> {
        if raw.len() > MAX_QUERY_BYTES {
            return Err("Query exceeds 16384 bytes");
        }
        let params: Vec<_> = url::form_urlencoded::parse(raw.as_bytes()).collect();
        let value = |key: &str, limit: usize| -> String {
            params
                .iter()
                .find(|(name, _)| name == key)
                .map(|(_, value)| value.trim().chars().take(limit).collect())
                .unwrap_or_default()
        };
        let campaign = value("campagne", 160);
        let page = value("page", 160);
        Ok(Self {
            campagne: (campaign.len() == 4 && campaign.bytes().all(|c| c.is_ascii_digit()))
                .then(|| campaign.parse().ok())
                .flatten(),
            q: value("q", 120)
                .split_whitespace()
                .collect::<Vec<_>>()
                .join(" "),
            page: if !page.starts_with('0')
                && page.len() <= 6
                && page.bytes().all(|c| c.is_ascii_digit())
            {
                page.parse().unwrap_or(1)
            } else {
                1
            },
            r#type: value("type", 160),
            region: value("region", 160),
            departement: value("departement", 160),
            statut: value("statut", 160),
            selectivite: value("selectivite", 160),
            tri: match value("tri", 20).as_str() {
                sort @ ("capacite" | "candidatures" | "admis" | "acces") => sort.into(),
                _ => "nom".into(),
            },
        })
    }

    pub fn resolve(&mut self, sources: &[CampaignSource]) -> Option<(CampaignSource, Vec<String>)> {
        let source = sources
            .iter()
            .find(|s| Some(s.campaign) == self.campagne)
            .or_else(|| sources.first())?
            .clone();
        let mut notices = Vec::new();
        if self
            .campagne
            .is_some_and(|campaign| campaign != source.campaign)
        {
            notices.push(format!(
                "La campagne demandée n’est pas disponible. La campagne {} est affichée.",
                source.campaign
            ));
        }
        self.campagne = Some(source.campaign);
        for (value, field, label) in [
            (&mut self.statut, "contrat_etab", "statut"),
            (&mut self.selectivite, "select_form", "sélectivité"),
        ] {
            if !value.is_empty() && !source.fields.iter().any(|f| f == field) {
                value.clear();
                self.page = 1;
                notices.push(format!(
                    "Le filtre {label} n’est pas publié pour cette campagne et a été retiré."
                ));
            }
        }
        Some((source, notices))
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CampaignSource {
    pub campaign: i32,
    pub release_id: String,
    pub dataset_id: String,
    pub provider: String,
    pub license: String,
    pub collected_at: String,
    pub modified_at: Option<String>,
    pub fields: Vec<String>,
}
