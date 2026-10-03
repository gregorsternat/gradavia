use std::process::Command;

#[test]
fn configuration_errors_fail_startup_without_leaking_credentials() {
    for value in [None, Some("https://user:private-value@example.test/db")] {
        let mut command = Command::new(env!("CARGO_BIN_EXE_orvio-api"));
        command
            .env_remove("DATABASE_URL")
            .env("API_BIND", "127.0.0.1:0");
        if let Some(value) = value {
            command.env("DATABASE_URL", value);
        }
        let output = command.output().unwrap();
        assert!(!output.status.success());
        let diagnostic = String::from_utf8(output.stderr).unwrap();
        assert!(diagnostic.contains("configuration_invalid"));
        assert!(!diagnostic.contains("private-value"));
        assert!(!diagnostic.contains("example.test"));
    }
}
