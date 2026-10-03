use clap::{Parser, Subcommand};
use orvio_aggregator::{config::DatabaseConfig, storage::check_database};
use std::{env, process::ExitCode};
use tracing::{error, info};

#[derive(Parser)]
#[command(
    name = "orvio-ingest",
    version,
    about = "Orvio data ingestion workspace"
)]
struct Cli {
    #[command(subcommand)]
    command: Command,
}

#[derive(Subcommand)]
enum Command {
    /// Check the runtime; optionally check a database without changing it.
    Doctor {
        #[arg(long)]
        database: bool,
    },
}

#[tokio::main]
async fn main() -> ExitCode {
    let cli = Cli::parse();
    // Keep SQL drivers silent: connection details and SQL errors may contain secrets.
    tracing_subscriber::fmt()
        .with_env_filter("orvio_ingest=info")
        .json()
        .with_writer(std::io::stderr)
        .init();

    match cli.command {
        Command::Doctor { database } => {
            if database {
                let config = env::var("DATABASE_URL_UNPOOLED")
                    .ok()
                    .and_then(|value| DatabaseConfig::parse(&value).ok());
                let Some(config) = config else {
                    error!(
                        event = "configuration_invalid",
                        "Set DATABASE_URL_UNPOOLED to a direct PostgreSQL URL"
                    );
                    return ExitCode::FAILURE;
                };
                if let Err(error) = check_database(&config).await {
                    error!(event = "database_unavailable", "{error}");
                    return ExitCode::FAILURE;
                }
            }
            info!(
                event = "doctor_complete",
                database_checked = database,
                "Runtime ready"
            );
            ExitCode::SUCCESS
        }
    }
}
