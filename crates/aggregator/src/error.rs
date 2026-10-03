use serde::Serialize;
use std::fmt;

/// Only controlled diagnostics cross the CLI boundary. Driver errors and row
/// contents can contain credentials or source values and are never displayed.
#[derive(Clone, Debug, Serialize)]
pub struct IngestError {
    pub code: &'static str,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub row: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub field: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sqlstate: Option<String>,
}

pub type Result<T> = std::result::Result<T, IngestError>;

impl IngestError {
    pub fn new(code: &'static str) -> Self {
        Self {
            code,
            row: None,
            field: None,
            sqlstate: None,
        }
    }

    pub fn at(mut self, row: u64) -> Self {
        self.row = Some(row);
        self
    }

    pub fn field(mut self, field: &str) -> Self {
        self.field = Some(field.to_owned());
        self
    }
}

impl fmt::Display for IngestError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(self.code)
    }
}

impl std::error::Error for IngestError {}

impl From<std::io::Error> for IngestError {
    fn from(_: std::io::Error) -> Self {
        Self::new("archive_io_failed")
    }
}

impl From<serde_json::Error> for IngestError {
    fn from(_: serde_json::Error) -> Self {
        Self::new("invalid_json")
    }
}

impl From<sqlx::Error> for IngestError {
    fn from(error: sqlx::Error) -> Self {
        let mut diagnostic = Self::new(match &error {
            sqlx::Error::Io(_) | sqlx::Error::Tls(_) | sqlx::Error::Protocol(_) => {
                "database_connection_failed"
            }
            _ => "database_operation_failed",
        });
        diagnostic.sqlstate = error.as_database_error().and_then(|error| {
            error
                .code()
                .filter(|code| {
                    code.len() == 5 && code.bytes().all(|byte| byte.is_ascii_alphanumeric())
                })
                .map(|code| code.into_owned())
        });
        diagnostic
    }
}
