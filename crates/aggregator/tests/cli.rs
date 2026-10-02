use std::process::Command;

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
