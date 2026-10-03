use crate::config::DatabaseConfig;
use sqlx::postgres::PgPoolOptions;
use std::time::Duration;
use thiserror::Error;

#[derive(Debug, Error)]
#[error("database diagnostic failed; check the selected branch, credentials, and network")]
pub struct DatabaseUnavailable;

/// Read-only connectivity check. Never migrates or imports implicitly.
pub async fn check_database(config: &DatabaseConfig) -> Result<(), DatabaseUnavailable> {
    let diagnostic = async {
        let pool = PgPoolOptions::new()
            .max_connections(1)
            .acquire_timeout(Duration::from_secs(10))
            .connect(config.connection_url())
            .await
            .map_err(|_| DatabaseUnavailable)?;
        let result = sqlx::query_scalar::<_, i32>("SELECT 1")
            .fetch_one(&pool)
            .await;
        pool.close().await;
        match result {
            Ok(1) => Ok(()),
            _ => Err(DatabaseUnavailable),
        }
    };
    tokio::time::timeout(Duration::from_secs(15), diagnostic)
        .await
        .map_err(|_| DatabaseUnavailable)?
}
