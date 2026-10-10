use std::{env, path::Path, process::ExitCode};

#[tokio::main]
async fn main() -> ExitCode {
    let args: Vec<_> = env::args().skip(1).collect();
    let [flag, output] = args.as_slice() else {
        eprintln!("Usage: gradavia-publish --output <new-directory>");
        return ExitCode::FAILURE;
    };
    if flag != "--output" {
        return ExitCode::FAILURE;
    }
    let Ok(pool) =
        gradavia_api::config::database_pool(&env::var("DATABASE_URL").unwrap_or_default())
    else {
        eprintln!("Publication requires an explicitly configured database.");
        return ExitCode::FAILURE;
    };
    let result = gradavia_api::publication::export(&pool, Path::new(output)).await;
    pool.close().await;
    match result {
        Ok(()) => {
            println!("Publication prepared and validated.");
            ExitCode::SUCCESS
        }
        Err(_) => {
            eprintln!(
                "Publication failed; no complete manifest was published. Previous publications remain unchanged."
            );
            ExitCode::FAILURE
        }
    }
}
