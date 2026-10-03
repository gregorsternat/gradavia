mod support;
use orvio_aggregator::{archive, registry, source::SourceClient};
use serde_json::{Value, json};
use std::{
    fs,
    sync::{
        Arc,
        atomic::{AtomicUsize, Ordering},
    },
};
use support::{Response, Server, fixture, jsonl, make_archive};

#[test]
fn reject_ambiguous_json_before_jsonb_can_discard_source_content() {
    for bytes in [
        br#"{"session":"2025","session":"2024"}"#.as_slice(),
        br#"{"nested":{"key":1,"key":2}}"#,
        br#"{"value":"\u0000"}"#,
        b"{\"value\":\xff}",
    ] {
        assert!(orvio_aggregator::json::parse(bytes).is_err());
    }
    let bytes = br#"{"precise":1.2345678901234567890123456789,"list":[1,null,"x"],"missing":null}"#;
    assert_eq!(
        orvio_aggregator::json::parse(bytes).unwrap()["precise"].to_string(),
        "1.2345678901234567890123456789"
    );
}

#[test]
fn all_fourteen_source_shapes_and_real_samples_match_the_pinned_contracts() {
    let sources = registry::datasets().unwrap();
    assert_eq!(sources.len(), 14);
    for source in sources {
        let (metadata, records) = fixture(&source);
        source.validate_metadata(&metadata).unwrap();
        for row in records {
            let projection = source.project(&row).unwrap();
            assert!(source.reviewed_campaigns.contains(&projection.campaign));
        }
    }
}

#[test]
fn preserve_zero_missing_masked_opaque_ids_and_numeric_precision() {
    let source = registry::dataset("fr-esr-apb_voeux-et-admissions").unwrap();
    let (_, mut records) = fixture(&source);
    let row = &mut records[0];
    row["cod_uai"] = json!("000001A");
    row["capa_fin"] = json!("0");
    row["voe_tot"] = json!("ns");
    row["acc_tot"] = Value::Null;
    row.as_object_mut().unwrap().remove("prop_tot");
    let projection = source.project(row).unwrap();
    assert_eq!(projection.establishment_id.as_deref(), Some("000001A"));
    assert_eq!(row["capa_fin"], "0");
    assert_eq!(row["voe_tot"], "ns");
    assert!(row["acc_tot"].is_null());
    assert!(row.get("prop_tot").is_none());
    let precise: Value =
        serde_json::from_str("{\"value\":123456789012345678901234567890.1234567890123456789}")
            .unwrap();
    assert_eq!(
        precise["value"].to_string(),
        "123456789012345678901234567890.1234567890123456789"
    );
}

#[test]
fn raw_identity_ignores_order_but_preserves_duplicate_multiplicity_and_revisions() {
    let root = support::tempdir();
    let source = registry::dataset("fr-esr-parcoursup").unwrap();
    let (metadata, records) = fixture(&source);
    let first = make_archive(
        &root.path().join("one"),
        &source,
        metadata.clone(),
        &records,
    );
    let reversed: Vec<_> = records.iter().rev().cloned().collect();
    let second = make_archive(
        &root.path().join("two"),
        &source,
        metadata.clone(),
        &reversed,
    );
    let a = archive::validate_manifest(&first, &source).unwrap();
    let b = archive::validate_manifest(&second, &source).unwrap();
    assert_eq!(a.manifest.fingerprint, b.manifest.fingerprint);
    assert_ne!(a.manifest.data.sha256, b.manifest.data.sha256);
    let mut duplicates = records.clone();
    duplicates.push(records[0].clone());
    let third = make_archive(
        &root.path().join("three"),
        &source,
        metadata.clone(),
        &duplicates,
    );
    let c = archive::validate_manifest(&third, &source).unwrap();
    assert_ne!(a.manifest.fingerprint, c.manifest.fingerprint);
    assert_eq!(c.manifest.row_count, 3);
    let mut revised = records;
    revised[0]["capa_fin"] = json!(4321);
    let fourth = make_archive(&root.path().join("four"), &source, metadata, &revised);
    assert_ne!(
        a.manifest.fingerprint,
        archive::validate_manifest(&fourth, &source)
            .unwrap()
            .manifest
            .fingerprint
    );
}

#[test]
fn corrupted_or_incomplete_archives_and_manifest_traversal_are_rejected() {
    let root = support::tempdir();
    let source = registry::dataset("fr-esr-parcoursup").unwrap();
    let (metadata, records) = fixture(&source);
    let path = make_archive(root.path(), &source, metadata, &records);
    let mut manifest: archive::Manifest =
        serde_json::from_slice(&fs::read(&path).unwrap()).unwrap();
    manifest.data.path = "../records.jsonl.gz".into();
    fs::write(&path, serde_json::to_vec(&manifest).unwrap()).unwrap();
    assert_eq!(
        archive::validate_manifest(&path, &source).unwrap_err().code,
        "invalid_archive_path"
    );
    manifest.data.path = "records.jsonl.gz".into();
    fs::write(&path, serde_json::to_vec(&manifest).unwrap()).unwrap();
    fs::write(root.path().join("records.jsonl.gz"), b"corrupt").unwrap();
    assert_eq!(
        archive::validate_manifest(&path, &source).unwrap_err().code,
        "corrupt_archive"
    );
}

#[test]
fn schema_and_representation_drift_have_field_diagnostics_without_row_contents() {
    let source = registry::dataset("fr-esr-parcoursup").unwrap();
    let (mut metadata, mut records) = fixture(&source);
    metadata["fields"][0]["type"] = json!("double");
    assert_eq!(
        source.validate_metadata(&metadata).unwrap_err().code,
        "schema_drift"
    );
    records[0]["capa_fin"] = json!("private-driver-value");
    let error = source.project(&records[0]).unwrap_err();
    assert_eq!(error.field.as_deref(), Some("capa_fin"));
    assert!(
        !serde_json::to_string(&error)
            .unwrap()
            .contains("private-driver-value")
    );
    records[0]["capa_fin"] = json!(0);
    records[0]["session"] = json!("20x5");
    assert_eq!(
        source.project(&records[0]).unwrap_err().code,
        "invalid_campaign"
    );
}

#[test]
fn complete_export_exceeds_ten_thousand_rows_and_archives_method_documents() {
    let source = registry::dataset("fr-esr-apb_voeux-et-admissions").unwrap();
    let (mut metadata, records) = fixture(&source);
    let records = vec![records[0].clone(); 10_017];
    let bytes = jsonl(&records);
    metadata["metas"]["default"]["records_count"] = json!(records.len());
    metadata["attachments"] =
        json!([{"id":"method","url":"https://ignored.example/unsafe","title":"Method"}]);
    let metadata = serde_json::to_vec(&metadata).unwrap();
    let server = Server::start(move |path| {
        assert!(!path.contains("limit="));
        if path.ends_with("/exports/jsonl") {
            Response::ok(bytes.clone())
        } else if path.ends_with("/attachments/method") {
            Response::ok(b"method document".to_vec())
        } else {
            Response::ok(metadata.clone())
        }
    });
    let root = support::tempdir();
    let client = SourceClient::new(server.base.clone()).unwrap();
    let path = client.collect(&source, root.path()).unwrap();
    let archive = archive::validate_manifest(&path, &source).unwrap();
    assert_eq!(archive.manifest.row_count, 10_017);
    assert_eq!(archive.manifest.attachments.len(), 1);
}

#[test]
fn retries_rate_limits_and_rejects_a_source_that_changes_during_collection() {
    let source = registry::dataset("fr-esr-parcoursup").unwrap();
    let (metadata, records) = fixture(&source);
    let bytes = jsonl(&records);
    let calls = Arc::new(AtomicUsize::new(0));
    let called = calls.clone();
    let server = Server::start(move |path| {
        let call = called.fetch_add(1, Ordering::SeqCst);
        if call == 0 {
            return Response {
                status: 429,
                body: Vec::new(),
                headers: vec![("Retry-After".into(), "0".into())],
                reported_length: None,
            };
        }
        if path.ends_with("/exports/jsonl") {
            Response::ok(bytes.clone())
        } else {
            let mut value = metadata.clone();
            value["metas"]["default"]["modified"] = json!(format!("revision-{call}"));
            Response::ok(serde_json::to_vec(&value).unwrap())
        }
    });
    let root = support::tempdir();
    let client = SourceClient::new(server.base.clone()).unwrap();
    let error = client.collect(&source, root.path()).unwrap_err();
    assert_eq!(error.code, "source_changed_during_download");
    assert_eq!(calls.load(Ordering::SeqCst), 10);
    assert!(root.path().join("attempt-3/failure.json").exists());
}

#[test]
fn truncated_body_never_produces_a_published_archive() {
    let source = registry::dataset("fr-esr-parcoursup").unwrap();
    let (metadata, records) = fixture(&source);
    let bytes = jsonl(&records);
    let metadata = serde_json::to_vec(&metadata).unwrap();
    let server = Server::start(move |path| {
        if path.ends_with("/exports/jsonl") {
            Response {
                status: 200,
                reported_length: Some(bytes.len() + 100),
                body: bytes.clone(),
                headers: Vec::new(),
            }
        } else {
            Response::ok(metadata.clone())
        }
    });
    let root = support::tempdir();
    let client = SourceClient::new(server.base.clone()).unwrap();
    assert!(client.collect(&source, root.path()).is_err());
    assert!(!root.path().join("attempt-1/manifest.json").exists());
    assert!(
        root.path()
            .join("attempt-1/records.jsonl.gz.attempt-2.partial")
            .exists()
    );
}
