use serde::{Deserialize, Serialize};
use url::Url;

pub use gradavia_read_model::query::{CampaignSource, ExplorerQuery, MAX_QUERY_BYTES, PAGE_SIZE};

#[derive(Debug, Serialize, Deserialize)]
pub struct Facets {
    pub r#type: Vec<String>,
    pub region: Vec<String>,
    pub departement: Vec<String>,
    pub statut: Vec<String>,
    pub selectivite: Vec<String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Formation {
    pub id: String,
    pub title: String,
    pub establishment: Option<String>,
    pub city: Option<String>,
    pub department: Option<String>,
    pub region: Option<String>,
    pub r#type: Option<String>,
    pub status: Option<String>,
    pub selectivity: Option<String>,
    pub parcoursup_url: Option<String>,
    pub source_formation_id: Option<String>,
    pub metrics: crate::analytics::metrics::Metrics,
}

#[derive(Debug, Serialize)]
pub struct ExplorerData {
    pub source: CampaignSource,
    pub campaigns: Vec<i32>,
    pub query: ExplorerQuery,
    pub facets: Facets,
    pub formations: Vec<Formation>,
    pub total: i32,
    pub notices: Vec<String>,
}

#[derive(Debug, Serialize)]
#[serde(tag = "status", rename_all = "lowercase")]
pub enum ExplorerResult {
    Ready { data: Box<ExplorerData> },
    Empty,
}

pub fn parcoursup_link(value: Option<&str>) -> Option<String> {
    let url = Url::parse(value?.trim()).ok()?;
    let host = url.host_str()?;
    (url.scheme() == "https"
        && url.username().is_empty()
        && url.password().is_none()
        && url.port().is_none()
        && (host == "parcoursup.fr" || host.ends_with(".parcoursup.fr")))
    .then(|| url.to_string())
}

pub fn source_text(value: Option<String>) -> Option<String> {
    value
        .filter(|text| !text.trim().is_empty())
        .map(|text| text.trim().to_owned())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn missing_descriptions_remain_null_without_erasing_observed_text() {
        assert_eq!(source_text(None), None);
        assert_eq!(source_text(Some(" \t\n\u{a0}".into())), None);
        assert_eq!(source_text(Some(" 0 ".into())), Some("0".into()));
        assert_eq!(
            source_text(Some(" Établissement\n".into())),
            Some("Établissement".into())
        );
    }

    #[test]
    fn bounds_and_normalizes_untrusted_query_parameters() {
        let query =
            ExplorerQuery::parse("campagne=2025&q=++École+++de+droit++&q=ignored&page=-2").unwrap();
        assert_eq!(query.campagne, Some(2025));
        assert_eq!(query.q, "École de droit");
        assert_eq!(query.page, 1);
        for page in ["0", "01", "-1", "Infinity", "9999999", ""] {
            assert_eq!(
                ExplorerQuery::parse(&format!("page={page}")).unwrap().page,
                1
            );
        }
        assert_eq!(ExplorerQuery::parse("page=999999").unwrap().page, 999999);
        assert_eq!(
            ExplorerQuery::parse("campagne=2025+OR+1=1")
                .unwrap()
                .campagne,
            None
        );
        let bounded =
            ExplorerQuery::parse(&format!("q={}&region={}", "é".repeat(150), "x".repeat(200)))
                .unwrap();
        assert_eq!(bounded.q.chars().count(), 120);
        assert_eq!(bounded.region.len(), 160);
        assert!(ExplorerQuery::parse(&"x".repeat(MAX_QUERY_BYTES + 1)).is_err());
    }

    #[test]
    fn only_published_https_parcoursup_links_are_accepted() {
        assert_eq!(
            parcoursup_link(Some("https://dossier.parcoursup.fr/fiche?id=0001")),
            Some("https://dossier.parcoursup.fr/fiche?id=0001".into())
        );
        for value in [
            "",
            "javascript:alert(1)",
            "https://parcoursup.fr.evil.test/",
            "https://evilparcoursup.fr/",
            "http://parcoursup.fr/",
            "https://user:password@parcoursup.fr/",
            "https://parcoursup.fr:8443/",
        ] {
            assert!(parcoursup_link(Some(value)).is_none());
        }
        assert!(parcoursup_link(None).is_none());
    }

    #[test]
    fn historical_filters_are_removed_with_notice_and_pagination_reset() {
        let source = CampaignSource {
            campaign: 2018,
            release_id: "release".into(),
            dataset_id: "dataset".into(),
            provider: "provider".into(),
            license: "license".into(),
            collected_at: "date".into(),
            modified_at: None,
            fields: Vec::new(),
        };
        let mut query =
            ExplorerQuery::parse("campagne=2018&statut=Public&selectivite=Sélective&page=5")
                .unwrap();
        let (_, notices) = query.resolve(std::slice::from_ref(&source)).unwrap();
        assert_eq!(query.page, 1);
        assert!(query.statut.is_empty() && query.selectivite.is_empty());
        assert_eq!(notices.len(), 2);
        let mut unknown = ExplorerQuery::parse("campagne=2099").unwrap();
        assert_eq!(unknown.resolve(&[source]).unwrap().1.len(), 1);
        assert_eq!(unknown.campagne, Some(2018));
        assert!(unknown.resolve(&[]).is_none());
    }
}
