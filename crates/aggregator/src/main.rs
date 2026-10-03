use clap::{Parser, Subcommand};
use orvio_aggregator::{config::DatabaseConfig, ingestion, registry, storage::check_database};
use std::{env, path::PathBuf, process::ExitCode};
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
    /// List supported source contracts without network or database access.
    Sources,
    /// Collect complete datasets and publish validated raw releases.
    Sync {
        /// Official dataset identifier; repeat to select several datasets.
        #[arg(long)]
        dataset: Vec<String>,
    },
    /// Show stored releases and the latest run for each imported dataset.
    Status,
    /// Import an immutable local archive without contacting the source.
    Replay {
        #[arg(long)]
        manifest: PathBuf,
    },
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
        Command::Sources => match registry::datasets() {
            Ok(sources) => {
                let summaries: Vec<_> = sources.iter().map(|source| serde_json::json!({
                        "dataset_id": source.id, "family": source.family, "archived": source.archived,
                        "contract_version": source.contract_version, "reviewed_campaigns": source.reviewed_campaigns,
                        "fields": source.fields.len()
                    })).collect();
                println!("{}", serde_json::json!({"sources":summaries}));
                ExitCode::SUCCESS
            }
            Err(error) => {
                error!(event = "registry_invalid", "{error}");
                ExitCode::FAILURE
            }
        },
        Command::Sync { dataset } => {
            let sources = if dataset.is_empty() {
                registry::datasets()
            } else {
                dataset.iter().map(|id| registry::dataset(id)).collect()
            };
            let sources = match sources {
                Ok(sources) => sources,
                Err(error) => {
                    error!(event = "source_selection_invalid", "{error}");
                    return ExitCode::FAILURE;
                }
            };
            let Some(config) = database_config() else {
                return ExitCode::FAILURE;
            };
            let root =
                PathBuf::from(env::var_os("RAW_DATA_DIR").unwrap_or_else(|| ".data/raw".into()));
            let diagnostics = diagnostics();
            let base =
                url::Url::parse(registry::CATALOG_BASE).expect("built-in catalog URL is valid");
            let mut failed = 0;
            for source in sources {
                info!(event="ingestion_started", dataset_id=%source.id);
                match ingestion::sync(&config, source.clone(), &root, &diagnostics, base.clone())
                    .await
                {
                    Ok(outcome) => println!(
                        "{}",
                        serde_json::json!({"event":"ingestion_complete","result":outcome})
                    ),
                    Err(diagnostic) => {
                        failed += 1;
                        error!(event="ingestion_failed",dataset_id=%source.id,code=diagnostic.code,row=diagnostic.row,field=?diagnostic.field,sqlstate=?diagnostic.sqlstate);
                    }
                }
            }
            info!(event = "sync_complete", failed);
            if failed == 0 {
                ExitCode::SUCCESS
            } else {
                ExitCode::FAILURE
            }
        }
        Command::Status => {
            let Some(config) = database_config() else {
                return ExitCode::FAILURE;
            };
            match ingestion::status(&config).await {
                Ok(status) => {
                    println!("{status}");
                    ExitCode::SUCCESS
                }
                Err(error) => {
                    error!(event = "status_failed", "{error}");
                    ExitCode::FAILURE
                }
            }
        }
        Command::Replay { manifest } => {
            let Some(config) = database_config() else {
                return ExitCode::FAILURE;
            };
            match ingestion::replay(&config, &manifest, &diagnostics()).await {
                Ok(outcome) => {
                    println!("{}", serde_json::json!({"result":outcome}));
                    ExitCode::SUCCESS
                }
                Err(diagnostic) => {
                    error!(event="replay_failed",code=diagnostic.code,row=diagnostic.row,field=?diagnostic.field,sqlstate=?diagnostic.sqlstate);
                    ExitCode::FAILURE
                }
            }
        }
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

fn database_config() -> Option<DatabaseConfig> {
    let config = env::var("DATABASE_URL_UNPOOLED")
        .ok()
        .and_then(|value| DatabaseConfig::parse(&value).ok());
    if config.is_none() {
        error!(
            event = "configuration_invalid",
            "Set DATABASE_URL_UNPOOLED to a direct PostgreSQL URL"
        );
    }
    config
}

fn diagnostics() -> PathBuf {
    env::var_os("ARTIFACTS_DIR")
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from(".artifacts"))
}
