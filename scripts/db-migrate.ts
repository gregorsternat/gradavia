import "./env";
import { migrateDatabase } from "../packages/db/src/migrate";
import { validateDatabaseUrl } from "../packages/db/src/config";

try {
  await migrateDatabase(
    validateDatabaseUrl(process.env.DATABASE_URL_UNPOOLED, true),
    "packages/db/migrations",
  );
  console.log(JSON.stringify({ event: "migrations_complete" }));
} catch {
  console.error(
    JSON.stringify({
      event: "migration_failed",
      message:
        "Check the migration files and direct connection for the intended branch.",
    }),
  );
  process.exitCode = 1;
}
