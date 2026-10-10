import { spawn } from "node:child_process";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { createTestDatabase } from "./test-postgres";
import { migrateDatabase } from "../packages/db/src/migrate";
import { startProcess, webEnvironment } from "./runtime";

// A single pg_dump snapshot freezes pointers and rows together. The expensive
// preparation then runs locally, with no production writes or repeated egress.
const output = resolve(process.argv[2] ?? "");
if (!process.argv[2]) throw new Error("A new output directory is required");
const artifacts = `${output}-preparation`;
await mkdir(artifacts);
function selectedSource() {
  try {
    return new URL(process.env.DATABASE_URL ?? "");
  } catch {
    throw new Error("Publication reader connection is missing or invalid");
  }
}
const source = selectedSource();
if (
  source.username !== "gradavia_api" ||
  !source.hostname.endsWith(".neon.tech") ||
  !process.env.PUBLICATION_EXPECTED_ENDPOINT ||
  !source.hostname.startsWith(process.env.PUBLICATION_EXPECTED_ENDPOINT)
)
  throw new Error(
    "Publication requires the explicitly selected Neon reader endpoint",
  );
function pgEnv(url: URL, readOnly = false) {
  const env = webEnvironment("");
  return {
    ...env,
    PGHOST: url.hostname.replace("-pooler.", "."),
    PGPORT: url.port || "5432",
    PGUSER: decodeURIComponent(url.username),
    PGPASSWORD: decodeURIComponent(url.password),
    PGDATABASE: url.pathname.slice(1),
    PGSSLMODE: readOnly ? "verify-full" : "disable",
    ...(readOnly ? { PGSSLROOTCERT: "system" } : {}),
    PGCONNECT_TIMEOUT: "15",
    ...(readOnly
      ? {
          PGOPTIONS:
            "-c default_transaction_read_only=on -c statement_timeout=900000",
        }
      : {}),
  };
}
async function command(name: string, args: string[], env: NodeJS.ProcessEnv) {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(name, args, {
      env,
      stdio: ["ignore", "ignore", "pipe"],
    });
    let diagnostic = "";
    child.stderr.on("data", (chunk) => {
      if (diagnostic.length < 8192) diagnostic += String(chunk);
    });
    child.once("error", () =>
      reject(new Error("Publication snapshot command unavailable")),
    );
    child.once("exit", (code) =>
      code === 0
        ? resolve()
        : reject(
            new Error(
              `Publication snapshot ${name} failed (${[/certificate|ssl/i, /authentication|password/i, /permission denied/i, /version/i, /connection|timeout/i].findIndex((rule) => rule.test(diagnostic))}); raw database diagnostics suppressed`,
            ),
          ),
    );
  });
}
const dump = join(artifacts, "public-sources.dump");
await command(
  "pg_dump",
  [
    "--format=custom",
    "--data-only",
    "--no-owner",
    "--no-privileges",
    "--table=public.source_datasets",
    "--table=public.source_releases",
    "--table=public.raw_records",
    "--file",
    dump,
  ],
  pgEnv(source, true),
);
console.log("Captured a consistent, read-only source snapshot.");
const database = await createTestDatabase(artifacts);
try {
  await migrateDatabase(database.url, "packages/db/migrations");
  await command(
    "pg_restore",
    [
      "--data-only",
      "--disable-triggers",
      "--no-owner",
      "--no-privileges",
      "--exit-on-error",
      "--single-transaction",
      "--dbname",
      new URL(database.url).pathname.slice(1),
      dump,
    ],
    pgEnv(new URL(database.url)),
  );
  await unlink(dump);
  const exporter = await startProcess(
    resolve("target/release/gradavia-publish"),
    ["--output", output],
    { ...webEnvironment(""), DATABASE_URL: database.url },
    join(artifacts, "export.log"),
  );
  exporter.child.stdout.pipe(process.stdout);
  if ((await exporter.closed) !== 0)
    throw new Error("Publication export failed; inspect the preparation log");
  await writeFile(
    join(artifacts, "source.json"),
    JSON.stringify({
      capturedAt: new Date().toISOString(),
      endpoint: process.env.PUBLICATION_EXPECTED_ENDPOINT,
      readOnly: true,
    }),
  );
} finally {
  await database.close();
}
