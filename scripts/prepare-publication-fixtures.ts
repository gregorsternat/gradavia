import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { createTestDatabase } from "./test-postgres";
import { migrateDatabase } from "../packages/db/src/migrate";
import { seedFormations } from "./seed-formations";
import { startProcess, webEnvironment } from "./runtime";
const root = resolve(".artifacts/publication-fixtures", randomUUID());
await mkdir(root, { recursive: true });
const db = await createTestDatabase(root);
try {
  await migrateDatabase(db.url, "packages/db/migrations");
  await seedFormations(db.url);
  const exporter = await startProcess(
    resolve("target/debug/gradavia-publish"),
    ["--output", resolve(root, "data")],
    { ...webEnvironment(""), DATABASE_URL: db.url },
    resolve(root, "export.log"),
  );
  if ((await exporter.closed) !== 0)
    throw new Error("Fixture publication failed");
  await writeFile(".artifacts/publication-fixture-path", resolve(root, "data"));
  console.log("Fixture publication prepared.");
} finally {
  await db.close();
}
