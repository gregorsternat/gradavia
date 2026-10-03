mod support;
use orvio_aggregator::{config::DatabaseConfig, ingestion, registry};
use serde_json::{Value, json};
use sqlx::Connection;
use std::{env, fs};
use support::{Response, Server, fixture, jsonl, make_archive};

#[tokio::test]
#[ignore = "just test-db supplies a disposable migrated PostgreSQL 18 database"]
async fn raw_ingestion_database_contract() {
    let uri = env::var("ORVIO_TEST_DATABASE_URL").expect("run through just test-db");
    let parsed = url::Url::parse(&uri).expect("valid local test URL");
    assert!(matches!(
        parsed.host_str(),
        Some("127.0.0.1" | "localhost" | "[::1]")
    ));
    assert!(parsed.path().starts_with("/orvio_ingest_"));
    let config = DatabaseConfig::parse(&uri).unwrap();
    let mut connection = ingestion::connect(&config).await.unwrap();
    let root = support::tempdir();
    let diagnostics = root.path().join("diagnostics");
    // All real source shapes round-trip through generated Drizzle tables and COPY.
    for source in registry::datasets().unwrap() {
        let (metadata, mut records) = fixture(&source);
        if source.id == "fr-esr-parcoursup" {
            records[0]["cod_aff_form"] = json!("000042");
            records[0]["cod_uai"] = json!("000001A");
            records[0]["g_ea_lib_vx"] = json!("Text\twith\nquotes \" and slash \\");
            records[0]["capa_fin"] = json!(0);
            records[0]["pct_f"] = serde_json::from_str("12.12345678901234567890123456789").unwrap();
            records[0].as_object_mut().unwrap().remove("rang_der_max");
            records[0]["acc_tot"] = Value::Null;
        }
        if source.family == "apb" {
            records[0]["voe_tot"] = json!("ns");
        }
        let path = make_archive(&root.path().join(&source.id), &source, metadata, &records);
        let outcome = ingestion::replay(&config, &path, &diagnostics)
            .await
            .unwrap();
        assert_eq!(outcome.status, "published");
        assert_eq!(outcome.rows, 2);
        let stored: Vec<Value> = sqlx::query_scalar(
            "SELECT payload FROM raw_records WHERE release_id=$1 ORDER BY row_number",
        )
        .bind(outcome.release_id)
        .fetch_all(&mut connection)
        .await
        .unwrap();
        assert_eq!(stored, records);
        let second = ingestion::replay(&config, &path, &diagnostics)
            .await
            .unwrap();
        assert_eq!(second.status, "unchanged");
        assert_eq!(outcome.release_id, second.release_id);
    }
    let source = registry::dataset("fr-esr-parcoursup").unwrap();
    let current: uuid::Uuid =
        sqlx::query_scalar("SELECT current_release_id FROM source_datasets WHERE id=$1")
            .bind(&source.id)
            .fetch_one(&mut connection)
            .await
            .unwrap();
    let precision: String = sqlx::query_scalar(
        "SELECT payload->>'pct_f' FROM raw_records WHERE release_id=$1 AND row_number=1",
    )
    .bind(current)
    .fetch_one(&mut connection)
    .await
    .unwrap();
    assert_eq!(precision, "12.12345678901234567890123456789");
    let key: String = sqlx::query_scalar(
        "SELECT formation_id FROM raw_records WHERE release_id=$1 AND row_number=1",
    )
    .bind(current)
    .fetch_one(&mut connection)
    .await
    .unwrap();
    assert_eq!(key, "000042");
    let absent:bool=sqlx::query_scalar("SELECT NOT (payload ? 'rang_der_max') AND payload->'acc_tot'='null'::jsonb FROM raw_records WHERE release_id=$1 AND row_number=1").bind(current).fetch_one(&mut connection).await.unwrap();
    assert!(absent);

    // Full HTTP -> retained bytes -> validated COPY, including >10,000 rows.
    let (mut metadata, records) = fixture(&source);
    let records = vec![records[0].clone(); 10_017];
    metadata["metas"]["default"]["records_count"] = json!(records.len());
    let bytes = jsonl(&records);
    let metadata_bytes = serde_json::to_vec(&metadata).unwrap();
    let server = Server::start(move |path| {
        if path.ends_with("/exports/jsonl") {
            Response::ok(bytes.clone())
        } else {
            Response::ok(metadata_bytes.clone())
        }
    });
    let outcome = ingestion::sync(
        &config,
        source.clone(),
        &root.path().join("http"),
        &diagnostics,
        server.base.clone(),
    )
    .await
    .unwrap();
    assert_eq!(outcome.status, "published");
    assert_eq!(outcome.rows, 10_017);
    assert_ne!(outcome.release_id, current);
    let count: i64 = sqlx::query_scalar("SELECT count(*) FROM raw_records WHERE release_id=$1")
        .bind(outcome.release_id)
        .fetch_one(&mut connection)
        .await
        .unwrap();
    assert_eq!(count, 10_017);
    let repeat = ingestion::sync(
        &config,
        source.clone(),
        &root.path().join("http"),
        &diagnostics,
        server.base.clone(),
    )
    .await
    .unwrap();
    assert_eq!(repeat.status, "unchanged");
    assert_eq!(repeat.release_id, outcome.release_id);
    // A diagnostics directory failure must not report a committed import failed.
    let unavailable_diagnostics = root.path().join("diagnostics-file");
    fs::write(&unavailable_diagnostics, b"not a directory").unwrap();
    let without_report =
        ingestion::replay(&config, &outcome.manifest_path, &unavailable_diagnostics)
            .await
            .unwrap();
    assert_eq!(without_report.status, "unchanged");
    let old_path = root.path().join(&source.id).join("manifest.json");
    let old_replay = ingestion::replay(&config, &old_path, &diagnostics)
        .await
        .unwrap();
    assert_eq!(old_replay.status, "retained");
    let retained: uuid::Uuid =
        sqlx::query_scalar("SELECT current_release_id FROM source_datasets WHERE id=$1")
            .bind(&source.id)
            .fetch_one(&mut connection)
            .await
            .unwrap();
    assert_eq!(retained, outcome.release_id);

    // A concurrent owner makes the CLI refuse to run, without releasing its lock.
    sqlx::query("SELECT pg_advisory_lock($1)")
        .bind(ingestion::lock_key(&source.id))
        .execute(&mut connection)
        .await
        .unwrap();
    let locked = ingestion::replay(&config, &old_path, &diagnostics)
        .await
        .unwrap_err();
    assert_eq!(locked.code, "dataset_locked");
    sqlx::query("SELECT pg_advisory_unlock($1)")
        .bind(ingestion::lock_key(&source.id))
        .execute(&mut connection)
        .await
        .unwrap();

    // Inject a database-side failure after validation. No release, records, or
    // current pointer may survive the failed COPY transaction.
    sqlx::query("ALTER TABLE raw_records ADD CONSTRAINT test_reject_capacity CHECK (payload->>'capa_fin' IS DISTINCT FROM '987654321')").execute(&mut connection).await.unwrap();
    let (metadata, records) = fixture(&source);
    let mut failed_records = vec![records[0].clone(); 10_017];
    failed_records.last_mut().unwrap()["capa_fin"] = json!(987654321);
    let mut failed_metadata = metadata.clone();
    failed_metadata["metas"]["default"]["records_count"] = json!(failed_records.len());
    let failed_path = make_archive(
        &root.path().join("database-failure"),
        &source,
        failed_metadata,
        &failed_records,
    );
    let before: i64 = sqlx::query_scalar("SELECT count(*) FROM source_releases")
        .fetch_one(&mut connection)
        .await
        .unwrap();
    assert!(
        ingestion::replay(&config, &failed_path, &unavailable_diagnostics)
            .await
            .is_err()
    );
    let after: i64 = sqlx::query_scalar("SELECT count(*) FROM source_releases")
        .fetch_one(&mut connection)
        .await
        .unwrap();
    assert_eq!(before, after);
    let still_current: uuid::Uuid =
        sqlx::query_scalar("SELECT current_release_id FROM source_datasets WHERE id=$1")
            .bind(&source.id)
            .fetch_one(&mut connection)
            .await
            .unwrap();
    assert_eq!(still_current, outcome.release_id);
    sqlx::query("ALTER TABLE raw_records DROP CONSTRAINT test_reject_capacity")
        .execute(&mut connection)
        .await
        .unwrap();

    // Metadata drift archives the source and reports failure without publication.
    let mut drift = metadata.clone();
    drift["fields"][0]["type"] = json!("unknown");
    let body = serde_json::to_vec(&drift).unwrap();
    let data = jsonl(&records);
    let bad_server = Server::start(move |path| {
        if path.ends_with("/exports/jsonl") {
            Response::ok(data.clone())
        } else {
            Response::ok(body.clone())
        }
    });
    let failed = ingestion::sync(
        &config,
        source.clone(),
        &root.path().join("drift"),
        &diagnostics,
        bad_server.base.clone(),
    )
    .await
    .unwrap_err();
    assert_eq!(failed.code, "schema_drift");

    // A process killed after creating a run is reconciled by the next lock owner.
    let interrupted = uuid::Uuid::new_v4();
    sqlx::query("INSERT INTO ingestion_runs(id,dataset_id,mode,status,importer_version) VALUES($1,$2,'sync','running','test')").bind(interrupted).bind(&source.id).execute(&mut connection).await.unwrap();
    ingestion::replay(&config, &old_path, &diagnostics)
        .await
        .unwrap();
    let state: String = sqlx::query_scalar("SELECT status FROM ingestion_runs WHERE id=$1")
        .bind(interrupted)
        .fetch_one(&mut connection)
        .await
        .unwrap();
    assert_eq!(state, "interrupted");
    let status = ingestion::status(&config).await.unwrap();
    assert_eq!(status["datasets"].as_array().unwrap().len(), 14);
    assert!(fs::read_dir(diagnostics.join("ingestion")).unwrap().count() > 28);

    // A remote export may outlast the database's idle-session timeout. Keep the
    // lock-owning session alive with real queries throughout that wait. Protocol
    // pings alone do not reset PostgreSQL's idle-session timer.
    let mut idle_uri = parsed.clone();
    idle_uri
        .query_pairs_mut()
        .append_pair("options", "-c idle_session_timeout=70s");
    let idle_config = DatabaseConfig::parse(idle_uri.as_str()).unwrap();
    let mut idle_probe = ingestion::connect(&idle_config).await.unwrap();
    let idle_limit: i64 = sqlx::query_scalar(
        "SELECT setting::bigint FROM pg_settings WHERE name='idle_session_timeout'",
    )
    .fetch_one(&mut idle_probe)
    .await
    .unwrap();
    assert_eq!(idle_limit, 70_000);
    idle_probe.close().await.unwrap();
    let (metadata, mut records) = fixture(&source);
    records[0]["g_ea_lib_vx"] = json!("Slow export fixture");
    let body = serde_json::to_vec(&metadata).unwrap();
    let data = jsonl(&records);
    let slow_server = Server::start(move |path| {
        if path.ends_with("/exports/jsonl") {
            std::thread::sleep(std::time::Duration::from_secs(76));
            Response::ok(data.clone())
        } else {
            Response::ok(body.clone())
        }
    });
    let slow = ingestion::sync(
        &idle_config,
        source.clone(),
        &root.path().join("slow"),
        &diagnostics,
        slow_server.base.clone(),
    )
    .await
    .unwrap();
    assert_eq!(slow.status, "published");
    assert_eq!(slow.rows, 2);
    // A publisher can revert to an already stored snapshot. That changes the
    // current pointer and must report publication while reusing existing rows.
    let release_count: i64 = sqlx::query_scalar("SELECT count(*) FROM source_releases")
        .fetch_one(&mut connection)
        .await
        .unwrap();
    let reverted = ingestion::sync(
        &config,
        source,
        &root.path().join("reverted"),
        &diagnostics,
        server.base.clone(),
    )
    .await
    .unwrap();
    assert_eq!(reverted.status, "published");
    assert_eq!(reverted.release_id, outcome.release_id);
    let after_revert: i64 = sqlx::query_scalar("SELECT count(*) FROM source_releases")
        .fetch_one(&mut connection)
        .await
        .unwrap();
    assert_eq!(release_count, after_revert);
    connection.close().await.unwrap();
}
