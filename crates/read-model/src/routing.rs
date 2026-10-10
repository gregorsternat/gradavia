//! Resolve bounded API requests against one captured publication.
use crate::query::ExplorerQuery;
use serde_json::{Value, json};
use sha2::{Digest, Sha256};

#[derive(Debug)]
pub enum Route {
    Asset(String),
    Choices(String, String, String),
    Catalog(i32, ExplorerQuery),
    PatchedAsset(String, Vec<String>),
    Json(u16, Value),
}
pub fn error(status: u16, code: &str) -> Route {
    Route::Json(status, json!({"error":{"code":code}}))
}

pub fn resolve(path: &str, raw: &str, publication: &Value) -> Route {
    if raw.len() > 16_384 {
        return error(400, "invalid_query");
    }
    let pairs: Vec<_> = url::form_urlencoded::parse(raw.as_bytes()).collect();
    let get = |key: &str| {
        pairs
            .iter()
            .find(|(k, _)| k == key)
            .map(|(_, v)| v.as_ref())
            .unwrap_or_default()
    };
    if path == "/internal/choices" {
        return match resolve("/v1/atlas", raw, publication) {
            Route::Asset(path) => Route::Choices(
                path.replacen("atlas/", "choices/", 1)
                    .replace(".json", ".bin"),
                get("id").to_owned(),
                get("q").to_owned(),
            ),
            other => other,
        };
    }
    match path {
        "/health/live" | "/health/ready" => Route::Json(200, json!({"status":"ok"})),
        "/v1/sources" => Route::Asset("sources.json".into()),
        "/v1/formations" | "/v1/overview" => {
            let Ok(query) = ExplorerQuery::parse(raw) else {
                return error(400, "invalid_query");
            };
            let Some(sources) = publication["sources"].as_array() else {
                return error(503, "unavailable");
            };
            let Some(source) = sources
                .iter()
                .find(|s| s["campaign"].as_i64() == query.campagne.map(i64::from))
                .or_else(|| sources.first())
            else {
                return Route::Json(200, json!({"status":"empty"}));
            };
            let Some(year) = source["campaign"].as_i64() else {
                return error(503, "unavailable");
            };
            if path == "/v1/formations" {
                Route::Catalog(year as i32, query)
            } else {
                let Ok(source) = serde_json::from_value(source.clone()) else {
                    return error(503, "unavailable");
                };
                let mut query = query;
                let Some((_, notices)) = query.resolve(&[source]) else {
                    return error(503, "unavailable");
                };
                Route::PatchedAsset(format!("overview/{year}.json"), notices)
            }
        }
        "/v1/specialties" => {
            let meta = &publication["specialties"];
            if meta.is_null() {
                return Route::Asset("specialties/default.json".into());
            }
            let pair: String = get("paire").chars().take(800).collect();
            let group: String = get("groupe").chars().take(800).collect();
            let mut notices = Vec::new();
            let selected = if meta["groups"].get(&pair).is_some() {
                pair.as_str()
            } else {
                if !pair.is_empty() {
                    notices.push("Cette combinaison de spécialités n’est pas publiée. La combinaison la plus représentée est affichée.".into());
                }
                meta["defaultPair"].as_str().unwrap_or_default()
            };
            let groups = meta["groups"][selected].as_array();
            let suffix = if group.is_empty() {
                String::new()
            } else if groups.is_some_and(|groups| groups.iter().any(|g| g == &group)) {
                format!("-{}", hash(&group))
            } else {
                notices.push(
                    "Ce regroupement n’est pas publié pour cette combinaison et a été retiré."
                        .into(),
                );
                String::new()
            };
            Route::PatchedAsset(
                format!("specialties/{}{suffix}.json", hash(selected)),
                notices,
            )
        }
        "/v1/specialties/inverse" => {
            let id: String = get("formation").chars().take(1600).collect();
            if id.is_empty() {
                return Route::Asset("inverse/default.json".into());
            }
            if publication["inverse"]
                .as_array()
                .is_some_and(|rows| rows.iter().any(|r| r == &id))
            {
                Route::Asset(format!("inverse/{}.json", hash(&id)))
            } else {
                Route::PatchedAsset("inverse/default.json".into(),vec!["Ce libellé national n’est pas publié. Choisissez une formation dans la liste.".into()])
            }
        }
        "/v1/atlas" => {
            let family = match get("famille").trim() {
                "" | "parcoursup" => "parcoursup",
                "apprentissage" => "apprentissage",
                "apb" => "apb",
                _ => return error(400, "invalid_query"),
            };
            let campaign = get("campagne").trim();
            let year = if campaign.is_empty() {
                None
            } else {
                if campaign.len() != 4 || !campaign.bytes().all(|b| b.is_ascii_digit()) {
                    return error(400, "invalid_query");
                }
                Some(campaign.parse::<i64>().unwrap_or(0))
            };
            let version = get("version").trim().to_ascii_lowercase();
            if !version.is_empty() && !valid_version(&version) {
                return error(400, "invalid_query");
            }
            let Some(atlases) = publication["atlases"].as_array() else {
                return error(503, "unavailable");
            };
            let candidates = atlases.iter().filter(|a| {
                a["family"] == family
                    && (version.is_empty() || a["releaseId"] == version)
                    && (year.is_none() || a["campaign"].as_i64() == year)
                    && (!version.is_empty()
                        || publication["pointers"].as_array().is_some_and(|p| {
                            p.iter().any(|p| {
                                p["dataset"] == a["datasetId"] && p["release"] == a["releaseId"]
                            })
                        }))
            });
            // The year-specific source wins over the mutable Parcoursup alias.
            let mut candidates: Vec<_> = candidates.collect();
            candidates.sort_by_key(|a| {
                (
                    std::cmp::Reverse(a["campaign"].as_i64().unwrap_or(0)),
                    a["datasetId"] == "fr-esr-parcoursup",
                )
            });
            let Some(source) = candidates.first() else {
                return if year.is_some() || !version.is_empty() {
                    error(404, "not_found")
                } else {
                    Route::Json(200, json!({"status":"empty"}))
                };
            };
            Route::Asset(format!(
                "atlas/{family}/{}/{}.json",
                source["releaseId"].as_str().unwrap_or_default(),
                source["campaign"]
            ))
        }
        _ => {
            let (prefix, id) = if let Some(id) = path.strip_prefix("/v1/formations/") {
                ("details", id)
            } else if let Some(id) = path.strip_prefix("/v1/atlas/formations/") {
                ("atlas-details", id)
            } else {
                return error(404, "not_found");
            };
            let decoded = url::form_urlencoded::parse(format!("id={id}").as_bytes())
                .next()
                .map(|(_, s)| s.into_owned())
                .unwrap_or_default();
            let Some((release, row)) = decoded.split_once(':') else {
                return error(404, "not_found");
            };
            if !valid_version(release)
                || row.is_empty()
                || row.starts_with('0')
                || row.parse::<i64>().is_err()
                || !row.bytes().all(|b| b.is_ascii_digit())
            {
                return error(404, "not_found");
            }
            Route::Asset(format!(
                "{prefix}/{}:{row}.json",
                release.to_ascii_lowercase()
            ))
        }
    }
}
fn valid_version(s: &str) -> bool {
    s.len() == 36
        && s.bytes().enumerate().all(|(i, b)| {
            if [8, 13, 18, 23].contains(&i) {
                b == b'-'
            } else {
                b.is_ascii_hexdigit()
            }
        })
}

fn hash(s: &str) -> String {
    format!("{:x}", Sha256::digest(s.as_bytes()))
}
pub fn patch_notices(bytes: &[u8], notices: Vec<String>) -> Result<Vec<u8>, serde_json::Error> {
    let mut value: Value = serde_json::from_slice(bytes)?;
    if let Some(existing) = value["data"]["requestNotices"].as_array_mut() {
        let mut prefix: Vec<_> = notices.into_iter().map(Value::String).collect();
        prefix.append(existing);
        *existing = prefix;
    }
    serde_json::to_vec(&value)
}
