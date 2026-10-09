pub mod analytics;
pub mod atlas;
pub mod config;
pub mod formations;
pub mod publication;

use axum::{
    Json, Router,
    extract::{Path, RawQuery, Request, State},
    http::{StatusCode, header},
    middleware::{self, Next},
    response::{IntoResponse, Response},
    routing::get,
};
use formations::{domain::ExplorerQuery, repository};
use serde_json::json;
use sqlx::PgPool;
use std::time::{Duration, Instant};

pub fn router(pool: PgPool) -> Router {
    Router::new()
        .route("/v1/formations", get(explorer))
        .route("/v1/atlas", get(atlas_snapshot))
        .route("/v1/atlas/formations/{id}", get(atlas_detail))
        .route("/v1/formations/{id}", get(formation_detail))
        .route("/v1/overview", get(overview))
        .route("/v1/sources", get(sources))
        .route("/v1/specialties", get(specialties))
        .route("/v1/specialties/inverse", get(inverse_specialties))
        .route(
            "/health/live",
            get(|| async { Json(json!({"status":"ok"})) }),
        )
        .route("/health/ready", get(readiness))
        .fallback(|| async { error(StatusCode::NOT_FOUND, "not_found") })
        .method_not_allowed_fallback(|| async {
            error(StatusCode::METHOD_NOT_ALLOWED, "method_not_allowed")
        })
        .layer(middleware::from_fn(observe))
        .with_state(pool)
}

fn error(status: StatusCode, code: &'static str) -> Response {
    let mut response = (status, Json(json!({"error":{"code":code}}))).into_response();
    if status == StatusCode::SERVICE_UNAVAILABLE {
        response
            .headers_mut()
            .insert(header::RETRY_AFTER, "5".parse().unwrap());
    }
    response
}

async fn explorer(State(pool): State<PgPool>, RawQuery(raw): RawQuery) -> Response {
    let Ok(query) = ExplorerQuery::parse(raw.as_deref().unwrap_or_default()) else {
        return error(StatusCode::BAD_REQUEST, "invalid_query");
    };
    match tokio::time::timeout(Duration::from_secs(15), repository::read(&pool, query)).await {
        Ok(Ok(result)) => Json(result).into_response(),
        _ => error(StatusCode::SERVICE_UNAVAILABLE, "unavailable"),
    }
}

async fn atlas_snapshot(State(pool): State<PgPool>, RawQuery(raw): RawQuery) -> Response {
    let Ok(query) = atlas::Query::parse(raw.as_deref().unwrap_or_default()) else {
        return error(StatusCode::BAD_REQUEST, "invalid_query");
    };
    match tokio::time::timeout(Duration::from_secs(15), atlas::snapshot(&pool, query)).await {
        Ok(Ok(Some(result))) => Json(result).into_response(),
        Ok(Ok(None)) => error(StatusCode::NOT_FOUND, "not_found"),
        _ => error(StatusCode::SERVICE_UNAVAILABLE, "unavailable"),
    }
}
async fn atlas_detail(State(pool): State<PgPool>, Path(id): Path<String>) -> Response {
    match tokio::time::timeout(Duration::from_secs(15), atlas::detail(&pool, &id)).await {
        Ok(Ok(Some(result))) => Json(result).into_response(),
        Ok(Ok(None)) => error(StatusCode::NOT_FOUND, "not_found"),
        _ => error(StatusCode::SERVICE_UNAVAILABLE, "unavailable"),
    }
}

async fn overview(State(pool): State<PgPool>, RawQuery(raw): RawQuery) -> Response {
    let Ok(query) = ExplorerQuery::parse(raw.as_deref().unwrap_or_default()) else {
        return error(StatusCode::BAD_REQUEST, "invalid_query");
    };
    match tokio::time::timeout(
        Duration::from_secs(15),
        analytics::repository::overview(&pool, query),
    )
    .await
    {
        Ok(Ok(result)) => Json(result).into_response(),
        _ => error(StatusCode::SERVICE_UNAVAILABLE, "unavailable"),
    }
}

async fn formation_detail(State(pool): State<PgPool>, Path(id): Path<String>) -> Response {
    match tokio::time::timeout(
        Duration::from_secs(15),
        analytics::repository::detail(&pool, &id),
    )
    .await
    {
        Ok(Ok(Some(result))) => Json(result).into_response(),
        Ok(Ok(None)) => error(StatusCode::NOT_FOUND, "not_found"),
        _ => error(StatusCode::SERVICE_UNAVAILABLE, "unavailable"),
    }
}

async fn sources(State(pool): State<PgPool>) -> Response {
    match tokio::time::timeout(Duration::from_secs(15), analytics::sources::read(&pool)).await {
        Ok(Ok(result)) => Json(result).into_response(),
        _ => error(StatusCode::SERVICE_UNAVAILABLE, "unavailable"),
    }
}

async fn inverse_specialties(State(pool): State<PgPool>, RawQuery(raw): RawQuery) -> Response {
    let Ok(query) =
        analytics::specialties::inverse::Query::parse(raw.as_deref().unwrap_or_default())
    else {
        return error(StatusCode::BAD_REQUEST, "invalid_query");
    };
    match tokio::time::timeout(
        Duration::from_secs(15),
        analytics::specialties::inverse::read(&pool, query),
    )
    .await
    {
        Ok(Ok(result)) => Json(result).into_response(),
        _ => error(StatusCode::SERVICE_UNAVAILABLE, "unavailable"),
    }
}

async fn specialties(State(pool): State<PgPool>, RawQuery(raw): RawQuery) -> Response {
    let Ok(query) = analytics::specialties::Query::parse(raw.as_deref().unwrap_or_default()) else {
        return error(StatusCode::BAD_REQUEST, "invalid_query");
    };
    match tokio::time::timeout(
        Duration::from_secs(15),
        analytics::specialties::read(&pool, query),
    )
    .await
    {
        Ok(Ok(result)) => Json(result).into_response(),
        _ => error(StatusCode::SERVICE_UNAVAILABLE, "unavailable"),
    }
}

async fn readiness(State(pool): State<PgPool>) -> Response {
    match tokio::time::timeout(
        Duration::from_secs(8),
        sqlx::query("SELECT 1").fetch_one(&pool),
    )
    .await
    {
        Ok(Ok(_)) => Json(json!({"status":"ok"})).into_response(),
        _ => error(StatusCode::SERVICE_UNAVAILABLE, "unavailable"),
    }
}

async fn observe(request: Request, next: Next) -> Response {
    let started = Instant::now();
    // No raw URI/query/headers: they can carry user data or credentials.
    let route = match request.uri().path() {
        "/v1/formations" => "formations",
        "/v1/overview" => "overview",
        "/v1/atlas" => "atlas",
        path if path.starts_with("/v1/atlas/formations/") => "atlas_detail",
        "/v1/sources" => "sources",
        "/v1/specialties" => "specialties",
        path if path.starts_with("/v1/formations/") => "formation_detail",
        "/health/live" => "liveness",
        "/health/ready" => "readiness",
        _ => "unknown",
    };
    let mut response = next.run(request).await;
    response
        .headers_mut()
        .insert(header::CACHE_CONTROL, "no-store".parse().unwrap());
    tracing::info!(
        event = "request_complete",
        route,
        status = response.status().as_u16(),
        elapsed_ms = started.elapsed().as_millis() as u64
    );
    response
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::body::{Body, to_bytes};
    use tower::ServiceExt;

    #[tokio::test]
    async fn transport_contract_and_unavailable_database() {
        let pool = config::database_pool("postgres://user:secret@127.0.0.1:1/missing").unwrap();
        let app = router(pool.clone());
        for (method, uri, expected, code) in [
            ("GET", "/health/live", StatusCode::OK, None),
            ("GET", "/missing", StatusCode::NOT_FOUND, Some("not_found")),
            (
                "POST",
                "/v1/formations",
                StatusCode::METHOD_NOT_ALLOWED,
                Some("method_not_allowed"),
            ),
            (
                "GET",
                "/v1/formations",
                StatusCode::SERVICE_UNAVAILABLE,
                Some("unavailable"),
            ),
            (
                "GET",
                "/health/ready",
                StatusCode::SERVICE_UNAVAILABLE,
                Some("unavailable"),
            ),
        ] {
            let response = app
                .clone()
                .oneshot(
                    Request::builder()
                        .method(method)
                        .uri(uri)
                        .body(Body::empty())
                        .unwrap(),
                )
                .await
                .unwrap();
            assert_eq!(response.status(), expected);
            assert_eq!(response.headers()[header::CACHE_CONTROL], "no-store");
            let body = to_bytes(response.into_body(), 1024).await.unwrap();
            let value: serde_json::Value = serde_json::from_slice(&body).unwrap();
            if let Some(code) = code {
                assert_eq!(value["error"]["code"], code);
            }
            assert!(!String::from_utf8_lossy(&body).contains("secret"));
        }
        let response = app
            .oneshot(
                Request::builder()
                    .uri(format!("/v1/formations?q={}", "x".repeat(17000)))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::BAD_REQUEST);
        pool.close().await;
    }
}
