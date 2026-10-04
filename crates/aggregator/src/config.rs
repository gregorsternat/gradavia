use std::fmt;
use thiserror::Error;
use url::Url;

pub struct DatabaseConfig {
    url: String,
}

#[derive(Debug, Error)]
#[error("DATABASE_URL_UNPOOLED must be a direct PostgreSQL URL with a database name")]
pub struct InvalidDatabaseConfig;

impl DatabaseConfig {
    pub fn parse(value: &str) -> Result<Self, InvalidDatabaseConfig> {
        let parsed = Url::parse(value).map_err(|_| InvalidDatabaseConfig)?;
        if !matches!(parsed.scheme(), "postgres" | "postgresql")
            || parsed.host_str().is_none()
            || parsed.path().trim_matches('/').is_empty()
            || parsed
                .host_str()
                .is_some_and(|host| host.contains("-pooler."))
        {
            return Err(InvalidDatabaseConfig);
        }
        Ok(Self { url: value.into() })
    }

    pub fn connection_url(&self) -> &str {
        &self.url
    }
}

impl fmt::Debug for DatabaseConfig {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("DatabaseConfig")
            .field("url", &"[redacted]")
            .finish()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validates_direct_connection_and_redacts_secrets() {
        let config = DatabaseConfig::parse("postgresql://user:secret@localhost/gradavia").unwrap();
        assert!(!format!("{config:?}").contains("secret"));
        for value in [
            "",
            "not-a-url",
            "https://example.com/db",
            "postgres://localhost",
            "postgres://ep-example-pooler.neon.tech/db",
        ] {
            assert!(DatabaseConfig::parse(value).is_err());
        }
    }
}
