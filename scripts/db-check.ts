import "./env";
import { sql } from "drizzle-orm";
import { createNeonDatabase } from "../packages/db/src/neon";
import { validateDatabaseUrl } from "../packages/db/src/config";

try {
  const db = createNeonDatabase(validateDatabaseUrl(process.env.DATABASE_URL));
  await db.execute(sql`SELECT 1`);
  console.log(JSON.stringify({ event: "database_ready", driver: "neon-http" }));
} catch {
  console.error(
    JSON.stringify({
      event: "database_unavailable",
      message: "Check DATABASE_URL, the selected branch, and network access.",
    }),
  );
  process.exitCode = 1;
}
