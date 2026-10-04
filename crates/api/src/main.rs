use gradavia_api::{config, router};
use std::{env, process::ExitCode};

#[tokio::main]
async fn main() -> ExitCode {
    // Never enable raw SQLx errors or log user-controlled request contents.
    tracing_subscriber::fmt()
        .with_env_filter("gradavia_api=info")
        .json()
        .with_writer(std::io::stderr)
        .init();
    let address = match config::bind_address(
        &env::var("API_BIND").unwrap_or_else(|_| "127.0.0.1:3002".into()),
    ) {
        Ok(address) => address,
        Err(message) => {
            tracing::error!(event = "configuration_invalid", message);
            return ExitCode::FAILURE;
        }
    };
    let pool = match config::database_pool(&env::var("DATABASE_URL").unwrap_or_default()) {
        Ok(pool) => pool,
        Err(message) => {
            tracing::error!(event = "configuration_invalid", message);
            return ExitCode::FAILURE;
        }
    };
    let listener = match tokio::net::TcpListener::bind(address).await {
        Ok(listener) => listener,
        Err(_) => {
            tracing::error!(event = "bind_failed");
            return ExitCode::FAILURE;
        }
    };
    tracing::info!(event = "api_listening", address = %listener.local_addr().expect("bound listener"));
    let served = axum::serve(listener, router(pool.clone()))
        .with_graceful_shutdown(shutdown())
        .await;
    pool.close().await;
    match served {
        Ok(()) => ExitCode::SUCCESS,
        Err(_) => {
            tracing::error!(event = "serve_failed");
            ExitCode::FAILURE
        }
    }
}

async fn shutdown() {
    #[cfg(unix)]
    {
        let mut terminate =
            tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())
                .expect("install SIGTERM handler");
        tokio::select! { _ = tokio::signal::ctrl_c() => {}, _ = terminate.recv() => {} }
    }
    #[cfg(not(unix))]
    {
        let _ = tokio::signal::ctrl_c().await;
    }
}
