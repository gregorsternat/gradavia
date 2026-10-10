use gradavia_read_model::{
    SearchIndex,
    routing::{Route, patch_notices, resolve},
};
use serde_json::{Value, json};
use worker::*;

async fn asset(env: &Env, path: &str) -> Result<Response> {
    env.service("PUBLICATION")?
        .fetch(format!("https://publication.internal/{path}"), None)
        .await
}
fn error(status: u16, code: &str) -> Result<Response> {
    let mut response = Response::from_json(&json!({"error":{"code":code}}))?.with_status(status);
    response.headers_mut().set("cache-control", "no-store")?;
    if status == 503 {
        response.headers_mut().set("retry-after", "5")?;
    }
    if status == 405 {
        response.headers_mut().set("allow", "GET, HEAD")?;
    }
    Ok(response)
}
#[event(fetch)]
pub async fn fetch(request: Request, env: Env, _ctx: Context) -> Result<Response> {
    if request.method() != Method::Get && request.method() != Method::Head {
        return error(405, "method_not_allowed");
    }
    let result = read(&request, &env).await;
    match result {
        Ok(response) => {
            // Fetch response headers are immutable; clone the header collection
            // while keeping the asset body streamed.
            let headers = response.headers().clone();
            headers.set("cache-control", "no-store")?;
            let response = response.with_headers(headers);
            if request.method() == Method::Head {
                Response::empty().map(|r| {
                    r.with_status(response.status_code())
                        .with_headers(response.headers().clone())
                })
            } else {
                Ok(response)
            }
        }
        Err(_) => error(503, "unavailable"),
    }
}
async fn read(request: &Request, env: &Env) -> Result<Response> {
    let url = request.url()?;
    if url.path() == "/health/live" {
        return Response::from_json(&json!({"status":"ok"}));
    }
    let mut response = asset(env, "publication.json").await?;
    if response.status_code() != 200 {
        return error(503, "unavailable");
    }
    let publication: Value = response.json().await?;
    if publication["format"] != gradavia_read_model::FORMAT_VERSION {
        return error(503, "unavailable");
    }
    match resolve(url.path(), url.query().unwrap_or_default(), &publication) {
        Route::Json(status, value) => Response::from_json(&value).map(|r| r.with_status(status)),
        Route::Asset(path) => {
            let response = asset(env, &path).await?;
            match response.status_code() {
                200 => Ok(response),
                404 => error(404, "not_found"),
                _ => error(503, "unavailable"),
            }
        }
        Route::PatchedAsset(path, notices) => {
            let mut response = asset(env, &path).await?;
            if response.status_code() != 200 {
                return error(503, "unavailable");
            }
            if notices.is_empty() {
                return Ok(response);
            }
            let bytes = patch_notices(&response.bytes().await?, notices)?;
            let mut response = Response::from_bytes(bytes)?;
            response
                .headers_mut()
                .set("content-type", "application/json")?;
            Ok(response)
        }
        Route::Choices(path, id, q) => {
            let mut response = asset(env, &path).await?;
            if response.status_code() != 200 {
                return error(503, "unavailable");
            }
            let mut result =
                gradavia_read_model::choices::search(&response.bytes().await?, &id, &q)
                    .map_err(|_| Error::RustError("Invalid choice index".into()))?;
            let mut candidates = Vec::new();
            for id in result.candidates {
                let mut response = asset(env, &format!("atlas-details/{id}.json")).await?;
                if response.status_code() != 200 {
                    return error(503, "unavailable");
                }
                candidates.push(response.json::<Value>().await?["data"]["item"].clone());
            }
            result.response["data"]["candidates"] = Value::Array(candidates);
            if let Some(id) = result.selected {
                let mut response = asset(env, &format!("atlas-details/{id}.json")).await?;
                if response.status_code() != 200 {
                    return error(503, "unavailable");
                }
                result.response["data"]["selected"] =
                    response.json::<Value>().await?["data"]["item"].clone();
            }
            Response::from_json(&result.response)
        }
        Route::Catalog(year, query) => {
            let mut response = asset(env, &format!("indexes/{year}.bin")).await?;
            if response.status_code() != 200 {
                return error(503, "unavailable");
            }
            let bytes = response.bytes().await?;
            let catalog = SearchIndex::decode(&bytes)
                .map_err(|_| Error::RustError("Invalid catalog".into()))?;
            let mut result = catalog
                .search(query)
                .map_err(|_| Error::RustError("Invalid catalog".into()))?;
            let mut records = Vec::with_capacity(result.rows.len());
            for row in result.rows {
                let mut record = asset(env, &format!("formations/{year}/{row}.json")).await?;
                if record.status_code() != 200 {
                    return error(503, "unavailable");
                }
                records.push(record.json::<Value>().await?);
            }
            result.response["data"]["formations"] = Value::Array(records);
            Response::from_json(&result.response)
        }
    }
}
