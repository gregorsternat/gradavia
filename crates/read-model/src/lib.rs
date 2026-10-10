//! Portable publication contracts and deterministic catalog queries. No I/O.
pub mod choices;
pub mod query;
pub mod routing;

use query::{CampaignSource, ExplorerQuery, PAGE_SIZE};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use std::collections::{BTreeMap, BTreeSet};
use unicode_normalization::UnicodeNormalization;

pub const FORMAT_VERSION: u32 = 1;
pub const MAX_INDEX_BYTES: usize = 24 * 1024 * 1024;

#[derive(Debug, Serialize, Deserialize)]
pub struct CatalogRow {
    pub number: i64,
    pub search: String,
    pub title: String,
    pub establishment: Option<String>,
    pub filters: [String; 5],
    pub metrics: [Option<f64>; 4],
    /// Already validated public projection, never the source payload.
    pub formation: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Catalog {
    pub format: u32,
    pub source: CampaignSource,
    pub campaigns: Vec<i32>,
    pub rows: Vec<CatalogRow>,
    pub orders: [Vec<u32>; 5],
    pub facets: BTreeMap<String, Vec<String>>,
}

pub fn fold(value: &str) -> String {
    value
        .nfd()
        .filter(|c| !('\u{300}'..='\u{36f}').contains(c))
        .flat_map(char::to_lowercase)
        .collect::<String>()
        .replace('œ', "oe")
        .replace('æ', "ae")
}

impl Catalog {
    pub fn new(source: CampaignSource, campaigns: Vec<i32>, rows: Vec<CatalogRow>) -> Self {
        let mut orders: [Vec<u32>; 5] = std::array::from_fn(|_| (0..rows.len() as u32).collect());
        for (sort, order) in orders.iter_mut().enumerate() {
            order.sort_by(|&a, &b| {
                let (a, b) = (&rows[a as usize], &rows[b as usize]);
                let metric = if sort == 0 {
                    std::cmp::Ordering::Equal
                } else {
                    match (a.metrics[sort - 1], b.metrics[sort - 1]) {
                        (Some(a), Some(b)) => b.total_cmp(&a),
                        (Some(_), None) => std::cmp::Ordering::Less,
                        (None, Some(_)) => std::cmp::Ordering::Greater,
                        _ => std::cmp::Ordering::Equal,
                    }
                };
                metric
                    .then(a.title.cmp(&b.title))
                    .then_with(|| match (&a.establishment, &b.establishment) {
                        (Some(a), Some(b)) => a.cmp(b),
                        (Some(_), None) => std::cmp::Ordering::Less,
                        (None, Some(_)) => std::cmp::Ordering::Greater,
                        _ => std::cmp::Ordering::Equal,
                    })
                    .then(a.number.cmp(&b.number))
            });
        }
        let facets = ["type", "region", "departement", "statut", "selectivite"]
            .into_iter()
            .enumerate()
            .map(|(i, key)| {
                (
                    key.to_owned(),
                    rows.iter()
                        .map(|r| &r.filters[i])
                        .filter(|v| !v.is_empty())
                        .cloned()
                        .collect::<BTreeSet<_>>()
                        .into_iter()
                        .collect(),
                )
            })
            .collect();
        Self {
            format: FORMAT_VERSION,
            source,
            campaigns,
            rows,
            orders,
            facets,
        }
    }

    pub fn encode(&self) -> Result<Vec<u8>, &'static str> {
        let dictionaries: [Vec<String>; 5] = std::array::from_fn(|i| {
            self.rows
                .iter()
                .map(|r| r.filters[i].clone())
                .collect::<BTreeSet<_>>()
                .into_iter()
                .collect()
        });
        if dictionaries.iter().any(|d| d.len() > u16::MAX as usize) {
            return Err("Too many filter values");
        }
        let rows = self
            .rows
            .iter()
            .map(|r| SearchRow {
                number: r.number,
                search: &r.search,
                filters: std::array::from_fn(|i| {
                    dictionaries[i].binary_search(&r.filters[i]).unwrap() as u16
                }),
            })
            .collect();
        let index = SearchIndex {
            format: self.format,
            source: self.source.clone(),
            campaigns: self.campaigns.clone(),
            rows,
            dictionaries,
            orders: self.orders.clone(),
            facets: self.facets.clone(),
        };
        let bytes = postcard::to_allocvec(&index).map_err(|_| "Index serialization failed")?;
        if bytes.len() > MAX_INDEX_BYTES {
            return Err("Index exceeds publication budget");
        }
        Ok(bytes)
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SearchRow<'a> {
    pub number: i64,
    #[serde(borrow)]
    search: &'a str,
    filters: [u16; 5],
}
/// The read Worker borrows text directly from the compact index. Public row
/// projections are separate assets; a query only reads its 25 result records.
#[derive(Debug, Serialize, Deserialize)]
pub struct SearchIndex<'a> {
    format: u32,
    source: CampaignSource,
    campaigns: Vec<i32>,
    #[serde(borrow)]
    rows: Vec<SearchRow<'a>>,
    dictionaries: [Vec<String>; 5],
    orders: [Vec<u32>; 5],
    facets: BTreeMap<String, Vec<String>>,
}
pub struct SearchPage {
    pub response: Value,
    pub rows: Vec<i64>,
}
impl<'a> SearchIndex<'a> {
    pub fn decode(bytes: &'a [u8]) -> Result<Self, &'static str> {
        if bytes.len() > MAX_INDEX_BYTES {
            return Err("Index exceeds publication budget");
        }
        let index: Self = postcard::from_bytes(bytes).map_err(|_| "Invalid index")?;
        if index.format != FORMAT_VERSION
            || index.rows.len() > 100_000
            || index.rows.iter().any(|r| {
                r.number <= 0
                    || r.filters
                        .iter()
                        .enumerate()
                        .any(|(i, &v)| usize::from(v) >= index.dictionaries[i].len())
            })
            || index.orders.iter().any(|order| {
                order.len() != index.rows.len()
                    || order.iter().any(|&i| i as usize >= index.rows.len())
            })
        {
            return Err("Incompatible index");
        }
        Ok(index)
    }

    pub fn search(&self, mut query: ExplorerQuery) -> Result<SearchPage, &'static str> {
        let (_, notices) = query
            .resolve(std::slice::from_ref(&self.source))
            .ok_or("Missing source")?;
        let folded = fold(&query.q);
        let words: Vec<_> = folded.split_whitespace().collect();
        let filter_values = [
            &query.r#type,
            &query.region,
            &query.departement,
            &query.statut,
            &query.selectivite,
        ];
        let filters: Vec<_> = filter_values
            .iter()
            .enumerate()
            .map(|(i, wanted)| {
                if wanted.is_empty() {
                    None
                } else {
                    Some(
                        self.dictionaries[i]
                            .binary_search(wanted)
                            .ok()
                            .map(|v| v as u16),
                    )
                }
            })
            .collect();
        let sort = match query.tri.as_str() {
            "capacite" => 1,
            "candidatures" => 2,
            "admis" => 3,
            "acces" => 4,
            _ => 0,
        };
        let matched: Vec<_> = self.orders[sort]
            .iter()
            .copied()
            .filter(|&i| {
                let row = &self.rows[i as usize];
                filters
                    .iter()
                    .zip(&row.filters)
                    .all(|(wanted, actual)| wanted.is_none() || *wanted == Some(Some(*actual)))
                    && words.iter().all(|word| row.search.contains(word))
            })
            .collect();
        query.page = query.page.clamp(
            1,
            ((matched.len() as i32 + PAGE_SIZE - 1) / PAGE_SIZE).max(1),
        );
        let rows = matched
            .iter()
            .skip(((query.page - 1) * PAGE_SIZE) as usize)
            .take(PAGE_SIZE as usize)
            .map(|&i| self.rows[i as usize].number)
            .collect();
        Ok(SearchPage {
            response: json!({"status":"ready","data":{"source":self.source,"campaigns":self.campaigns,
            "query":query,"facets":self.facets,"formations":[],"total":matched.len(),"notices":notices}}),
            rows,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn catalog() -> Catalog {
        let source = CampaignSource {
            campaign: 2025,
            release_id: "release".into(),
            dataset_id: "dataset".into(),
            provider: "Test".into(),
            license: "Test".into(),
            collected_at: "2026-01-01".into(),
            modified_at: None,
            fields: vec!["contrat_etab".into(), "select_form".into()],
        };
        Catalog::new(
            source,
            vec![2025],
            ["École Cœur 100%", "École Cœur 1000", "Lycée Æther _"]
                .into_iter()
                .enumerate()
                .map(|(i, title)| CatalogRow {
                    number: i as i64 + 1,
                    search: fold(title),
                    title: fold(title),
                    establishment: None,
                    filters: [
                        "BTS".into(),
                        "Paris".into(),
                        String::new(),
                        String::new(),
                        String::new(),
                    ],
                    metrics: [Some(i as f64), None, None, None],
                    formation: json!({"id":i+1,"title":title}).to_string(),
                })
                .collect(),
        )
    }
    #[test]
    fn literal_search_normalization_filter_and_page_bounds() {
        let bytes = catalog().encode().unwrap();
        let index = SearchIndex::decode(&bytes).unwrap();
        for (raw, total, id) in [
            ("q=ecole+coeur+%25", 1, 1),
            ("q=aether+_", 1, 3),
            ("q=absent", 0, 0),
            ("type=BTS&tri=capacite&page=999", 3, 3),
            ("region=paris", 0, 0),
        ] {
            let result = index.search(ExplorerQuery::parse(raw).unwrap()).unwrap();
            let data = result.response;
            assert_eq!(data["data"]["total"], total);
            assert_eq!(data["data"]["query"]["page"], 1);
            if total > 0 {
                assert_eq!(result.rows[0], id);
            }
        }
    }
    #[test]
    fn incompatible_and_truncated_indexes_fail_closed() {
        assert!(SearchIndex::decode(b"broken").is_err());
        let mut index = catalog();
        index.format = 0;
        assert!(SearchIndex::decode(&index.encode().unwrap()).is_err());
    }
}
