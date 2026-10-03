import "server-only";
import { createNeonDatabase } from "@orvio/db/neon";
import { validateDatabaseUrl } from "@orvio/db/config";

export function getDatabase() {
  // Validate lazily: static pages and builds do not need a database connection.
  return createNeonDatabase(validateDatabaseUrl(process.env.DATABASE_URL));
}
