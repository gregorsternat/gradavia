use crate::{
    archive::{self, ValidatedArchive},
    config::DatabaseConfig,
    error::{IngestError, Result},
    registry::{Dataset, IMPORTER_VERSION},
    source::SourceClient,
};
use flate2::read::GzDecoder;
use serde::Serialize;
use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use sqlx::{ConnectOptions, Connection, PgConnection, Row, postgres::PgConnectOptions};
use std::{
    fs::{self, File},
    io::{BufRead, BufReader, Read},
    path::{Path, PathBuf},
    str::FromStr,
    time::Duration,
};
use url::Url;
use uuid::Uuid;

#[derive(Debug, Serialize)]
pub struct Outcome {
    pub dataset_id: String,
    pub run_id: Uuid,
    pub release_id: Uuid,
    pub status: String,
    pub rows: u64,
    pub bytes: u64,
    pub manifest_path: PathBuf,
}

pub async fn connect(config: &DatabaseConfig) -> Result<PgConnection> {
    let options = PgConnectOptions::from_str(config.connection_url())
        .map_err(|_| IngestError::new("invalid_database_config"))?
        .application_name("orvio-ingest")
        .disable_statement_logging();
    let mut connection = tokio::time::timeout(
        Duration::from_secs(20),
        PgConnection::connect_with(&options),
    )
    .await
    .map_err(|_| IngestError::new("database_connect_timeout"))??;
    sqlx::query("SET statement_timeout = '10min'")
        .execute(&mut connection)
        .await?;
    sqlx::query("SET idle_in_transaction_session_timeout = '2min'")
        .execute(&mut connection)
        .await?;
    Ok(connection)
}

pub fn lock_key(dataset_id: &str) -> i64 {
    let digest = Sha256::digest(format!("orvio-ingestion:{dataset_id}"));
    i64::from_be_bytes(digest[..8].try_into().expect("SHA-256 has eight bytes"))
}

async fn start(
    connection: &mut PgConnection,
    source: &Dataset,
    id: Uuid,
    mode: &str,
) -> Result<()> {
    let locked: bool = sqlx::query_scalar("SELECT pg_try_advisory_lock($1)")
        .bind(lock_key(&source.id))
        .fetch_one(&mut *connection)
        .await?;
    if !locked {
        return Err(IngestError::new("dataset_locked"));
    }
    sqlx::query("INSERT INTO source_datasets (id,family,provider,archived) VALUES ($1,$2,$3,$4) ON CONFLICT (id) DO UPDATE SET family=excluded.family,provider=excluded.provider,archived=excluded.archived")
        .bind(&source.id).bind(&source.family).bind(&source.provider).bind(source.archived).execute(&mut *connection).await?;
    // Holding the session lock proves older running attempts have no live owner.
    sqlx::query("UPDATE ingestion_runs SET status='interrupted',finished_at=clock_timestamp(),diagnostic='{\"code\":\"previous_process_interrupted\"}'::jsonb WHERE dataset_id=$1 AND status='running'")
        .bind(&source.id).execute(&mut *connection).await?;
    sqlx::query("INSERT INTO ingestion_runs (id,dataset_id,mode,status,importer_version) VALUES ($1,$2,$3,'running',$4)")
        .bind(id).bind(&source.id).bind(mode).bind(IMPORTER_VERSION).execute(connection).await?;
    Ok(())
}

pub async fn sync(
    config: &DatabaseConfig,
    source: Dataset,
    raw_root: &Path,
    diagnostics: &Path,
    base: Url,
) -> Result<Outcome> {
    let id = Uuid::new_v4();
    let mut connection = connect(config).await?;
    start(&mut connection, &source, id, "sync").await?;
    let run_root = raw_root.join(&source.id).join(id.to_string());
    let fetch_source = source.clone();
    let result = async {
        let mut collector = tokio::task::spawn_blocking(move || {
            SourceClient::new(base)?.collect(&fetch_source, &run_root)
        });
        let manifest = loop {
            tokio::select! {
                result = &mut collector => {
                    break result.map_err(|_| IngestError::new("collector_task_failed"))??;
                }
                _ = tokio::time::sleep(Duration::from_secs(60)) => {
                    // Long exports must not leave the lock-owning session idle
                    // long enough for a serverless database to suspend it.
                    if let Err(error) = sqlx::query("SELECT 1").execute(&mut connection).await {
                        // Retain the complete archive, and keep source collection
                        // sequential even after losing the database session.
                        let _ = collector.await;
                        return Err(error.into());
                    }
                }
            }
        };
        load_and_publish(&mut connection, &source, &manifest, id, false).await
    }
    .await;
    complete(&mut connection, &source, id, result, diagnostics).await
}

pub async fn replay(config: &DatabaseConfig, path: &Path, diagnostics: &Path) -> Result<Outcome> {
    let manifest: archive::Manifest = serde_json::from_reader(File::open(path)?.take(1024 * 1024))?;
    let source = crate::registry::dataset(&manifest.dataset_id)?;
    let id = Uuid::new_v4();
    let mut connection = connect(config).await?;
    start(&mut connection, &source, id, "replay").await?;
    let result = load_and_publish(&mut connection, &source, path, id, true).await;
    complete(&mut connection, &source, id, result, diagnostics).await
}

async fn complete(
    connection: &mut PgConnection,
    source: &Dataset,
    id: Uuid,
    result: Result<Outcome>,
    diagnostics: &Path,
) -> Result<Outcome> {
    if let Err(error) = &result {
        // Failure of this update is retained locally; the next lock owner will
        // mark a dangling run interrupted. Never replace the primary diagnostic.
        let _ = sqlx::query("UPDATE ingestion_runs SET status='failed',finished_at=clock_timestamp(),diagnostic=$2,rejected_count=$3 WHERE id=$1 AND status='running'")
            .bind(id).bind(serde_json::to_value(error)?).bind(i64::from(error.row.is_some())).execute(&mut *connection).await;
    }
    let report = match &result {
        Ok(outcome) => json!({"result":outcome}),
        Err(error) => {
            json!({"dataset_id":source.id,"run_id":id,"status":"failed","diagnostic":error})
        }
    };
    let directory = diagnostics.join("ingestion");
    let report_result = fs::create_dir_all(&directory)
        .map_err(IngestError::from)
        .and_then(|()| archive::write_json(&directory.join(format!("{id}.json")), &report));
    // Close the session even if unlock fails; it must never return to a pool.
    let _ = sqlx::query("SELECT pg_advisory_unlock($1)")
        .bind(lock_key(&source.id))
        .execute(&mut *connection)
        .await;
    if report_result.is_err() {
        // A diagnostics disk failure cannot undo an already committed release or
        // replace the original import error. The database status remains true.
        tracing::warn!(target: "orvio_ingest", event="diagnostic_write_failed", run_id=%id);
    }
    result
}

async fn load_and_publish(
    connection: &mut PgConnection,
    source: &Dataset,
    manifest_path: &Path,
    run_id: Uuid,
    replay: bool,
) -> Result<Outcome> {
    let path = manifest_path.to_owned();
    let contract = source.clone();
    let archive = tokio::task::spawn_blocking(move || archive::validate_manifest(&path, &contract))
        .await
        .map_err(|_| IngestError::new("validation_task_failed"))??;
    let manifest = &archive.manifest;
    sqlx::query(
        "UPDATE ingestion_runs SET manifest_path=$2,row_count=$3,data_bytes=$4 WHERE id=$1",
    )
    .bind(run_id)
    .bind(archive.manifest_path.to_string_lossy().as_ref())
    .bind(manifest.row_count as i64)
    .bind(manifest.data.bytes as i64)
    .execute(&mut *connection)
    .await?;
    let mut transaction = connection.begin().await?;
    let existing: Option<Uuid> =
        sqlx::query_scalar("SELECT id FROM source_releases WHERE dataset_id=$1 AND fingerprint=$2")
            .bind(&source.id)
            .bind(&manifest.fingerprint)
            .fetch_optional(&mut *transaction)
            .await?;
    let release_id = existing.unwrap_or_else(Uuid::new_v4);
    if existing.is_none() {
        let license = archive.metadata["metas"]["default"]["license"]
            .as_str()
            .ok_or_else(|| IngestError::new("missing_license"))?;
        let modified = archive.metadata["metas"]["default"]["modified"].as_str();
        sqlx::query("INSERT INTO source_releases (id,dataset_id,fingerprint,contract_version,collected_at,source_modified_at,importer_version,license,metadata,manifest,manifest_path,row_count,data_bytes,campaigns) VALUES ($1,$2,$3,$4,$5::text::timestamptz,$6::text::timestamptz,$7,$8,$9,$10,$11,$12,$13,$14)")
            .bind(release_id).bind(&source.id).bind(&manifest.fingerprint).bind(manifest.contract_version as i32).bind(&manifest.collected_at).bind(modified).bind(&manifest.importer_version).bind(license)
            .bind(&archive.metadata).bind(serde_json::to_value(manifest)?).bind(archive.manifest_path.to_string_lossy().as_ref())
            .bind(manifest.row_count as i64).bind(manifest.data.bytes as i64).bind(serde_json::to_value(&manifest.campaigns)?).execute(&mut *transaction).await?;
        copy_records(&mut transaction, source, &archive, release_id).await?;
    }
    let current: Option<Uuid> =
        sqlx::query_scalar("SELECT current_release_id FROM source_datasets WHERE id=$1 FOR UPDATE")
            .bind(&source.id)
            .fetch_one(&mut *transaction)
            .await?;
    let promote = !replay || current.is_none() || current == Some(release_id);
    if promote {
        sqlx::query("UPDATE source_datasets SET current_release_id=$2 WHERE id=$1")
            .bind(&source.id)
            .bind(release_id)
            .execute(&mut *transaction)
            .await?;
    }
    let status = if !promote {
        "retained"
    } else if current == Some(release_id) {
        "unchanged"
    } else {
        "published"
    };
    sqlx::query("UPDATE ingestion_runs SET status=$2,release_id=$3,finished_at=clock_timestamp() WHERE id=$1")
        .bind(run_id)
        .bind(status)
        .bind(release_id)
        .execute(&mut *transaction)
        .await?;
    transaction.commit().await?;
    Ok(Outcome {
        dataset_id: source.id.clone(),
        run_id,
        release_id,
        status: status.into(),
        rows: manifest.row_count,
        bytes: manifest.data.bytes,
        manifest_path: archive.manifest_path,
    })
}

fn copy_text(value: &str, output: &mut Vec<u8>) {
    for byte in value.bytes() {
        match byte {
            b'\\' => output.extend_from_slice(b"\\\\"),
            b'\t' => output.extend_from_slice(b"\\t"),
            b'\n' => output.extend_from_slice(b"\\n"),
            b'\r' => output.extend_from_slice(b"\\r"),
            _ => output.push(byte),
        }
    }
}

async fn copy_records(
    connection: &mut PgConnection,
    source: &Dataset,
    archive: &ValidatedArchive,
    release_id: Uuid,
) -> Result<()> {
    let mut reader = BufReader::new(GzDecoder::new(File::open(&archive.data_path)?));
    let mut line = Vec::new();
    const COPY_BATCH_BYTES: usize = 4 * 1024 * 1024;
    let mut buffer = Vec::with_capacity(COPY_BATCH_BYTES);
    let mut digest = Sha256::new();
    let mut rows = 0u64;
    let mut batch_rows = 0u64;
    loop {
        line.clear();
        let length = Read::by_ref(&mut reader)
            .take((archive::MAX_RECORD_BYTES + 1) as u64)
            .read_until(b'\n', &mut line)?;
        if length == 0 {
            break;
        }
        rows += 1;
        batch_rows += 1;
        if length > archive::MAX_RECORD_BYTES {
            return Err(IngestError::new("record_size_limit").at(rows));
        }
        digest.update(&line);
        let value = crate::json::parse(&line).map_err(|error| error.at(rows))?;
        let projection = source.project(&value).map_err(|error| error.at(rows))?;
        buffer.extend_from_slice(
            format!("{release_id}\t{rows}\t{}\t", projection.campaign).as_bytes(),
        );
        for id in [&projection.establishment_id, &projection.formation_id] {
            if let Some(id) = id {
                copy_text(id, &mut buffer);
            } else {
                buffer.extend_from_slice(b"\\N");
            }
            buffer.push(b'\t');
        }
        copy_text(
            std::str::from_utf8(&line)
                .map_err(|_| IngestError::new("invalid_record_utf8"))?
                .trim_end_matches(['\r', '\n']),
            &mut buffer,
        );
        buffer.push(b'\n');
        if buffer.len() >= COPY_BATCH_BYTES {
            copy_batch(connection, &buffer, batch_rows).await?;
            tracing::info!(target: "orvio_ingest", event="records_loaded", dataset_id=%source.id, rows, total=archive.manifest.row_count);
            buffer.clear();
            batch_rows = 0;
        }
    }
    if rows != archive.manifest.row_count
        || format!("{:x}", digest.finalize()) != archive.manifest.data.sha256
    {
        return Err(IngestError::new("archive_changed_during_load"));
    }
    if !buffer.is_empty() {
        copy_batch(connection, &buffer, batch_rows).await?;
    }
    Ok(())
}

// Bound each COPY statement for slow remote links while keeping every batch in
// the caller's single transaction. No batch becomes visible before publication.
async fn copy_batch(connection: &mut PgConnection, bytes: &[u8], rows: u64) -> Result<()> {
    let mut copy = connection.copy_in_raw("COPY raw_records (release_id,row_number,campaign,establishment_id,formation_id,payload) FROM STDIN").await?;
    if let Err(error) = copy.send(bytes).await {
        let _ = copy.abort("raw import transfer failed").await;
        return Err(error.into());
    }
    if copy.finish().await? != rows {
        return Err(IngestError::new("database_row_count_mismatch"));
    }
    Ok(())
}

pub async fn status(config: &DatabaseConfig) -> Result<Value> {
    let mut connection = connect(config).await?;
    let rows = sqlx::query("SELECT d.id,d.family,d.archived,d.current_release_id, (SELECT jsonb_agg(jsonb_build_object('id',r.id,'current',r.id=d.current_release_id,'collected_at',r.collected_at,'source_modified_at',r.source_modified_at,'rows',r.row_count,'bytes',r.data_bytes,'campaigns',r.campaigns,'fingerprint',r.fingerprint,'manifest_path',r.manifest_path) ORDER BY r.created_at DESC) FROM source_releases r WHERE r.dataset_id=d.id) AS releases, (SELECT to_jsonb(run) FROM ingestion_runs run WHERE run.dataset_id=d.id ORDER BY run.started_at DESC LIMIT 1) AS last_run FROM source_datasets d ORDER BY d.id")
        .fetch_all(&mut connection).await?;
    let mut datasets = Vec::with_capacity(rows.len());
    for row in rows {
        datasets.push(json!({"dataset_id":row.try_get::<String,_>("id")?,"family":row.try_get::<String,_>("family")?,"archived":row.try_get::<bool,_>("archived")?,"current_release_id":row.try_get::<Option<Uuid>,_>("current_release_id")?,"releases":row.try_get::<Option<Value>,_>("releases")?.unwrap_or(json!([])),"last_run":row.try_get::<Option<Value>,_>("last_run")?}));
    }
    Ok(json!({"datasets":datasets}))
}
