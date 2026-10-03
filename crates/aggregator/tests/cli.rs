use std::process::Command;

#[test]
fn sources_lists_all_contracts_without_credentials() {
    let output = Command::new(env!("CARGO_BIN_EXE_orvio-ingest"))
        .arg("sources")
        .env_remove("DATABASE_URL_UNPOOLED")
        .output()
        .unwrap();
    assert!(output.status.success());
    let value: serde_json::Value = serde_json::from_slice(&output.stdout).unwrap();
    assert_eq!(value["sources"].as_array().unwrap().len(), 14);
}

#[test]
fn unknown_source_is_rejected_before_any_database_work() {
    let output = Command::new(env!("CARGO_BIN_EXE_orvio-ingest"))
        .args([
            "sync",
            "--dataset",
            "fr-esr-parcoursup",
            "--dataset",
            "unknown",
        ])
        .env_remove("DATABASE_URL_UNPOOLED")
        .output()
        .unwrap();
    assert!(!output.status.success());
    assert!(String::from_utf8_lossy(&output.stderr).contains("source_selection_invalid"));
    assert!(!String::from_utf8_lossy(&output.stderr).contains("ingestion_started"));
}

#[test]
fn doctor_runs_without_credentials() {
    let output = Command::new(env!("CARGO_BIN_EXE_orvio-ingest"))
        .arg("doctor")
        .env_remove("DATABASE_URL_UNPOOLED")
        .output()
        .unwrap();
    assert!(output.status.success());
    assert!(String::from_utf8_lossy(&output.stderr).contains("doctor_complete"));
}

#[test]
fn invalid_configuration_fails_without_disclosing_input() {
    let output = Command::new(env!("CARGO_BIN_EXE_orvio-ingest"))
        .args(["doctor", "--database"])
        .env(
            "DATABASE_URL_UNPOOLED",
            "https://user:secret-value@example.com/db",
        )
        .output()
        .unwrap();
    assert!(!output.status.success());
    assert!(!String::from_utf8_lossy(&output.stderr).contains("secret-value"));
    assert!(String::from_utf8_lossy(&output.stderr).contains("configuration_invalid"));
}
