use std::{env, path::PathBuf, process::ExitCode};
#[tokio::main]
async fn main() -> ExitCode {
    let Some(root) = env::var_os("GRADAVIA_PUBLICATION_DIR") else {
        eprintln!("Publication directory required");
        return ExitCode::FAILURE;
    };
    let bind = env::var("API_BIND").unwrap_or_else(|_| "127.0.0.1:3002".into());
    let Ok(listener) = tokio::net::TcpListener::bind(&bind).await else {
        eprintln!("Publication listener unavailable");
        return ExitCode::FAILURE;
    };
    println!(
        "Publication server listening on {}",
        listener.local_addr().unwrap()
    );
    let result = axum::serve(
        listener,
        gradavia_api::publication::router(PathBuf::from(root)),
    )
    .await;
    if result.is_ok() {
        ExitCode::SUCCESS
    } else {
        eprintln!("Publication server failed");
        ExitCode::FAILURE
    }
}
