use sqlx::{ConnectOptions, PgPool, postgres::PgConnectOptions, postgres::PgPoolOptions};
use std::{net::SocketAddr, str::FromStr, time::Duration};
use url::Url;

/// Validate configuration without exposing credentials through parser errors or Debug.
pub fn database_pool(value: &str) -> Result<PgPool, &'static str> {
    let invalid = "DATABASE_URL must be a PostgreSQL URL with a database name";
    let url = Url::parse(value).map_err(|_| invalid)?;
    if !matches!(url.scheme(), "postgres" | "postgresql")
        || url.host_str().is_none()
        || url.path().trim_matches('/').is_empty()
    {
        return Err(invalid);
    }
    let options = PgConnectOptions::from_str(value)
        .map_err(|_| invalid)?
        .application_name("gradavia-api")
        .disable_statement_logging();
    Ok(PgPoolOptions::new()
        .max_connections(5)
        .min_connections(0)
        .acquire_timeout(Duration::from_secs(8))
        .idle_timeout(Duration::from_secs(60))
        .max_lifetime(Duration::from_secs(600))
        .connect_lazy_with(options))
}

pub fn bind_address(value: &str) -> Result<SocketAddr, &'static str> {
    value
        .parse()
        .map_err(|_| "API_BIND must be an IP address and port")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn invalid_configuration_never_exposes_input() {
        for value in [
            "",
            "https://user:secret@example.com/db",
            "postgres://localhost",
        ] {
            let error = database_pool(value).err().unwrap();
            assert!(!error.contains("secret"));
            assert!(!error.contains(value) || value.is_empty());
        }
        let pool = database_pool("postgres://user:secret@localhost/gradavia").unwrap();
        assert_eq!(
            pool.size(),
            0,
            "Configuration never connects during startup"
        );
        pool.close().await;
        assert!(bind_address("127.0.0.1:3002").is_ok());
        assert!(bind_address("not-a-socket").is_err());
    }
}
