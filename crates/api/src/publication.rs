//! Explicit, read-only preparation of immutable public projections.
use crate::{
    analytics, atlas,
    formations::{
        domain::ExplorerQuery,
        repository::{self, ReadError},
    },
};
use gradavia_read_model::{Catalog, CatalogRow, FORMAT_VERSION, SearchIndex};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use sqlx::{PgPool, Row};
use std::{collections::BTreeMap, fs, path::Path};

impl From<std::io::Error> for ReadError {
    fn from(_: std::io::Error) -> Self {
        Self
    }
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct FileRecord {
    bytes: usize,
    sha256: String,
}
struct Writer<'a> {
    root: &'a Path,
    files: BTreeMap<String, FileRecord>,
}
impl Writer<'_> {
    fn bytes(&mut self, name: &str, bytes: &[u8]) -> Result<(), ReadError> {
        // Keep each object below Cloudflare's 25 MiB individual asset limit.
        if name.contains("..") || name.starts_with('/') || bytes.len() > 96 * 1024 * 1024 {
            return Err(ReadError);
        }
        if bytes.len() > 24 * 1024 * 1024 {
            let mut parts = Vec::new();
            for (i, part) in bytes.chunks(24 * 1024 * 1024).enumerate() {
                let name = format!("{name}.parts/{i}");
                self.bytes(&name, part)?;
                parts.push(name);
            }
            return self.json(
                &format!("{name}.parts.json"),
                &json!({"parts":parts,"sha256":format!("{:x}",Sha256::digest(bytes))}),
            );
        }
        let path = self.root.join(name);
        fs::create_dir_all(path.parent().ok_or(ReadError)?)?;
        fs::write(path, bytes)?;
        self.files.insert(
            name.into(),
            FileRecord {
                bytes: bytes.len(),
                sha256: format!("{:x}", Sha256::digest(bytes)),
            },
        );
        Ok(())
    }
    fn json(&mut self, name: &str, value: &impl Serialize) -> Result<(), ReadError> {
        self.bytes(name, &serde_json::to_vec(value)?)
    }
}
fn encoded(value: &str) -> String {
    url::form_urlencoded::byte_serialize(value.as_bytes()).collect()
}
fn hash(value: &str) -> String {
    format!("{:x}", Sha256::digest(value.as_bytes()))
}
async fn pointers(pool: &PgPool) -> Result<Value, ReadError> {
    let rows = sqlx::query(
        "SELECT id,current_release_id::text AS release FROM source_datasets ORDER BY id",
    )
    .fetch_all(pool)
    .await?;
    rows.into_iter().map(|r| Ok(json!({"dataset":r.try_get::<String,_>("id")?,"release":r.try_get::<Option<String>,_>("release")?})))
        .collect::<Result<Vec<_>,ReadError>>().map(Value::Array)
}

pub async fn export(pool: &PgPool, root: &Path) -> Result<(), ReadError> {
    // Never overwrite a complete or partial previous attempt.
    fs::create_dir(root)?;
    let before = pointers(pool).await?;
    let mut writer = Writer {
        root,
        files: BTreeMap::new(),
    };
    let mut connection = pool.acquire().await?;
    let sources = repository::campaigns(&mut connection).await?;
    drop(connection);
    let years: Vec<_> = sources.iter().map(|s| s.campaign).collect();
    let prefix = include_str!("formations/explorer.sql")
        .split_once("), words AS (")
        .ok_or(ReadError)?
        .0;
    let index_sql = format!(
        "{prefix}) SELECT to_jsonb(searchable) AS record FROM searchable ORDER BY row_number"
    );
    for source in &sources {
        let rows = sqlx::query(sqlx::AssertSqlSafe(index_sql.as_str()))
            .bind(&source.release_id)
            .bind(source.campaign)
            .fetch_all(pool)
            .await?;
        let records = rows
            .into_iter()
            .map(|row| {
                let value: Value = row.try_get("record")?;
                let raw: repository::DescriptiveRow = serde_json::from_value(value.clone())?;
                let formation = raw.formation(&source.release_id);
                let metrics = ["capacity", "applications", "admitted", "accessRate"]
                    .map(|key| formation.metrics.get(key).and_then(|v| v.value));
                Ok(CatalogRow {
                    number: value["row_number"].as_i64().ok_or(ReadError)?,
                    search: value["search_text"].as_str().ok_or(ReadError)?.into(),
                    title: value["sort_title"].as_str().ok_or(ReadError)?.into(),
                    establishment: value["sort_establishment"].as_str().map(str::to_owned),
                    filters: ["type", "region", "departement", "statut", "selectivite"]
                        .map(|key| value[key].as_str().unwrap_or_default().into()),
                    metrics,
                    formation: serde_json::to_string(&formation)?,
                })
            })
            .collect::<Result<Vec<_>, ReadError>>()?;
        let index = Catalog::new(source.clone(), years.clone(), records);
        for row in &index.rows {
            writer.bytes(
                &format!("formations/{}/{}.json", source.campaign, row.number),
                row.formation.as_bytes(),
            )?;
        }
        writer.bytes(
            &format!("indexes/{}.bin", source.campaign),
            &index.encode().map_err(|_| ReadError)?,
        )?;
        writer.json(
            &format!("overview/{}.json", source.campaign),
            &analytics::repository::overview(
                pool,
                ExplorerQuery::parse(&format!("campagne={}", source.campaign))
                    .map_err(|_| ReadError)?,
            )
            .await?,
        )?;
        println!(
            "Prepared campaign {}: {} catalog records",
            source.campaign,
            index.rows.len()
        );
    }
    writer.json("sources.json", &analytics::sources::read(pool).await?)?;
    let mut atlases = Vec::new();
    let mut details = Vec::new();
    for family in ["parcoursup", "apprentissage", "apb"] {
        let db_family = if family == "apprentissage" {
            "apprenticeship"
        } else {
            family
        };
        // Retain every admitted source version, including rows no longer current.
        let versions=sqlx::query("SELECT r.id::text AS id,r.campaigns FROM source_releases r JOIN source_datasets d ON d.id=r.dataset_id WHERE d.family=$1 ORDER BY r.id").bind(db_family).fetch_all(pool).await?;
        for version in versions {
            let id: String = version.try_get("id")?;
            let campaigns: Value = version.try_get("campaigns")?;
            for year in campaigns.as_object().ok_or(ReadError)?.keys() {
                let query = format!("famille={family}&campagne={year}&version={id}");
                let Some(snapshot) =
                    atlas::snapshot(pool, atlas::Query::parse(&query).map_err(|_| ReadError)?)
                        .await?
                else {
                    continue;
                };
                let snapshot = serde_json::to_value(snapshot)?;
                if snapshot["status"] != "ready" {
                    continue;
                }
                writer.json(&format!("atlas/{family}/{id}/{year}.json"), &snapshot)?;
                writer.bytes(
                    &format!("choices/{family}/{id}/{year}.bin"),
                    &gradavia_read_model::choices::encode(&snapshot).map_err(|_| ReadError)?,
                )?;
                atlases.push(json!({"family":family,"campaign":year.parse::<i32>().map_err(|_|ReadError)?,"releaseId":id,
                    "datasetId":snapshot["data"]["source"]["datasetId"]}));
                for item in snapshot["data"]["items"].as_array().ok_or(ReadError)? {
                    let record = item["id"].as_str().ok_or(ReadError)?;
                    let detail = atlas::detail(pool, record).await?.ok_or(ReadError)?;
                    writer.json(&format!("atlas-details/{record}.json"), &detail)?;
                    if family == "parcoursup" {
                        let detail = analytics::repository::detail(pool, record)
                            .await?
                            .ok_or(ReadError)?;
                        writer.json(&format!("details/{record}.json"), &detail)?;
                    }
                    details.push(json!({"id":record,"family":family}));
                }
                println!(
                    "Prepared {family} {year}: {} details",
                    snapshot["data"]["items"].as_array().ok_or(ReadError)?.len()
                );
            }
        }
    }
    let mut specialty_groups = BTreeMap::<String, Vec<String>>::new();
    let specialty = serde_json::to_value(
        analytics::specialties::read(
            pool,
            analytics::specialties::Query::parse("").map_err(|_| ReadError)?,
        )
        .await?,
    )?;
    writer.json("specialties/default.json", &specialty)?;
    if let Some(pairs) = specialty["data"]["pairs"].as_array() {
        for pair in pairs {
            let id = pair["id"].as_str().ok_or(ReadError)?;
            let query = format!("paire={}", encoded(id));
            let result = serde_json::to_value(
                analytics::specialties::read(
                    pool,
                    analytics::specialties::Query::parse(&query).map_err(|_| ReadError)?,
                )
                .await?,
            )?;
            writer.json(&format!("specialties/{}.json", hash(id)), &result)?;
            specialty_groups.insert(
                id.into(),
                result["data"]["groups"]
                    .as_array()
                    .ok_or(ReadError)?
                    .iter()
                    .filter_map(|g| g["group"].as_str().map(str::to_owned))
                    .collect(),
            );
            for group in result["data"]["groups"].as_array().ok_or(ReadError)? {
                let group = group["group"].as_str().ok_or(ReadError)?;
                let response = analytics::specialties::read(
                    pool,
                    analytics::specialties::Query::parse(&format!(
                        "{query}&groupe={}",
                        encoded(group)
                    ))
                    .map_err(|_| ReadError)?,
                )
                .await?;
                writer.json(
                    &format!("specialties/{}-{}.json", hash(id), hash(group)),
                    &response,
                )?;
            }
        }
    }
    let inverse = serde_json::to_value(
        analytics::specialties::inverse::read(
            pool,
            analytics::specialties::inverse::Query::parse("").map_err(|_| ReadError)?,
        )
        .await?,
    )?;
    writer.json("inverse/default.json", &inverse)?;
    if let Some(formations) = inverse["data"]["formations"].as_array() {
        for formation in formations {
            let id = formation["id"].as_str().ok_or(ReadError)?;
            let result = analytics::specialties::inverse::read(
                pool,
                analytics::specialties::inverse::Query::parse(&format!(
                    "formation={}",
                    encoded(id)
                ))
                .map_err(|_| ReadError)?,
            )
            .await?;
            writer.json(&format!("inverse/{}.json", hash(id)), &result)?;
        }
    }
    if before != pointers(pool).await? {
        return Err(ReadError);
    }
    writer.json("details.json", &details)?;
    writer.json("publication.json",&json!({"format":FORMAT_VERSION,"sources":sources,"pointers":before,"atlases":atlases, "specialties":if specialty["status"]=="ready" {json!({"defaultPair":specialty["data"]["selectedPair"]["id"],"groups":specialty_groups})} else {Value::Null}, "inverse":inverse["data"]["formations"].as_array().map(|v|v.iter().map(|v|v["id"].clone()).collect::<Vec<_>>()).unwrap_or_default()}))?;
    let manifest = serde_json::to_vec(&json!({"format":FORMAT_VERSION,"files":writer.files}))?;
    fs::write(root.join("manifest.json.partial"), &manifest)?;
    fs::rename(
        root.join("manifest.json.partial"),
        root.join("manifest.json"),
    )?;
    Ok(())
}

fn read_asset(root: &Path, name: &str) -> Result<Vec<u8>, std::io::Error> {
    match fs::read(root.join(name)) {
        Ok(bytes) => Ok(bytes),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            let metadata: Value =
                serde_json::from_slice(&fs::read(root.join(format!("{name}.parts.json")))?)?;
            let parts = metadata["parts"]
                .as_array()
                .filter(|p| p.len() <= 4)
                .ok_or(std::io::ErrorKind::InvalidData)?;
            let mut bytes = Vec::new();
            for part in parts {
                let part = part
                    .as_str()
                    .filter(|p| p.starts_with(&format!("{name}.parts/")) && !p.contains(".."))
                    .ok_or(std::io::ErrorKind::InvalidData)?;
                bytes.extend(fs::read(root.join(part))?);
            }
            Ok(bytes)
        }
        Err(error) => Err(error),
    }
}
/// Local publication server for contract tests and credential-free rendering.
pub fn router(root: std::path::PathBuf) -> axum::Router {
    use axum::{
        extract::{Request, State},
        response::IntoResponse,
    };
    async fn read(
        State(root): State<std::path::PathBuf>,
        request: Request,
    ) -> axum::response::Response {
        if !matches!(request.method().as_str(), "GET" | "HEAD") {
            return (
                axum::http::StatusCode::METHOD_NOT_ALLOWED,
                axum::Json(json!({"error":{"code":"method_not_allowed"}})),
            )
                .into_response();
        }
        let response = (|| -> Result<(u16, Vec<u8>), ReadError> {
            let publication: Value =
                serde_json::from_slice(&fs::read(root.join("publication.json"))?)?;
            use gradavia_read_model::routing::{Route, resolve};
            match resolve(
                request.uri().path(),
                request.uri().query().unwrap_or_default(),
                &publication,
            ) {
                Route::Json(status, value) => Ok((status, serde_json::to_vec(&value)?)),
                Route::Asset(path) => match read_asset(&root, &path) {
                    Ok(bytes) => Ok((200, bytes)),
                    Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok((
                        404,
                        serde_json::to_vec(&json!({"error":{"code":"not_found"}}))?,
                    )),
                    Err(_) => Err(ReadError),
                },
                Route::PatchedAsset(path, notices) => Ok((
                    200,
                    gradavia_read_model::routing::patch_notices(
                        &read_asset(&root, &path)?,
                        notices,
                    )?,
                )),
                Route::Choices(path, id, q) => {
                    let bytes = read_asset(&root, &path)?;
                    let mut result = gradavia_read_model::choices::search(&bytes, &id, &q)
                        .map_err(|_| ReadError)?;
                    let item = |id: &str| -> Result<Value, ReadError> {
                        let value: Value = serde_json::from_slice(&read_asset(
                            &root,
                            &format!("atlas-details/{id}.json"),
                        )?)?;
                        Ok(value["data"]["item"].clone())
                    };
                    result.response["data"]["candidates"] = Value::Array(
                        result
                            .candidates
                            .iter()
                            .map(|id| item(id))
                            .collect::<Result<Vec<_>, _>>()?,
                    );
                    if let Some(id) = result.selected {
                        result.response["data"]["selected"] = item(&id)?;
                    }
                    Ok((200, serde_json::to_vec(&result.response)?))
                }
                Route::Catalog(year, query) => {
                    let bytes = fs::read(root.join(format!("indexes/{year}.bin")))?;
                    let index = SearchIndex::decode(&bytes).map_err(|_| ReadError)?;
                    let mut result = index.search(query).map_err(|_| ReadError)?;
                    let records = result
                        .rows
                        .iter()
                        .map(|row| {
                            serde_json::from_slice(&fs::read(
                                root.join(format!("formations/{year}/{row}.json")),
                            )?)
                            .map_err(ReadError::from)
                        })
                        .collect::<Result<Vec<Value>, ReadError>>()?;
                    result.response["data"]["formations"] = Value::Array(records);
                    Ok((200, serde_json::to_vec(&result.response)?))
                }
            }
        })();
        let (status, body) =
            response.unwrap_or_else(|_| (503, b"{\"error\":{\"code\":\"unavailable\"}}".to_vec()));
        (
            axum::http::StatusCode::from_u16(status).unwrap(),
            [
                ("content-type", "application/json"),
                ("cache-control", "no-store"),
            ],
            body,
        )
            .into_response()
    }
    axum::Router::new().fallback(read).with_state(root)
}
