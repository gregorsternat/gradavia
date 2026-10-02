import { readMigrationFiles } from "drizzle-orm/migrator";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { validateDatabaseUrl } from "./config";
import { createNodeClient } from "./node";

export async function migrateDatabase(
  connectionString: string,
  migrationsFolder: string,
  migrationsSchema = "drizzle",
) {
  validateDatabaseUrl(connectionString, true);
  // An empty scaffold should not create a migration schema in a remote database.
  if (readMigrationFiles({ migrationsFolder }).length === 0) return;
  const { client, db } = createNodeClient(connectionString);
  try {
    await client.connect();
    await migrate(db, { migrationsFolder, migrationsSchema });
  } finally {
    await client.end();
  }
}
