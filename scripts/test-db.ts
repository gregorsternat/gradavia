import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createNodeClient } from "../packages/db/src/node";
import { migrateDatabase } from "../packages/db/src/migrate";

const artifacts = path.resolve(
  process.env.ARTIFACTS_DIR ?? ".artifacts",
  "database",
);
await mkdir(artifacts, { recursive: true });
const id = randomUUID().replaceAll("-", "");
const container = `orvio-test-${id}`;
const schema = `probe_${id}`;
const journalSchema = `journal_${id}`;
const folder = await mkdtemp(path.join(tmpdir(), "orvio-migrations-"));
let ownsContainer = false;
let client: ReturnType<typeof createNodeClient>["client"] | undefined;
let connected = false;
let phase = "start-postgres";

function docker(...args: string[]) {
  return execFileSync("docker", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 120_000,
  }).trim();
}

try {
  let url = process.env.TEST_DATABASE_URL;
  if (!url) {
    docker(
      "run",
      "--rm",
      "-d",
      "--name",
      container,
      "-e",
      "POSTGRES_USER=orvio",
      "-e",
      "POSTGRES_PASSWORD=orvio",
      "-e",
      "POSTGRES_DB=orvio_test",
      "-p",
      "127.0.0.1::5432",
      "postgres:18",
    );
    ownsContainer = true;
    const address = docker("port", container, "5432/tcp");
    url = `postgresql://orvio:orvio@${address}/orvio_test`;
    let ready = false;
    for (let attempt = 0; attempt < 60; attempt++) {
      try {
        docker(
          "exec",
          container,
          "pg_isready",
          "-h",
          "127.0.0.1",
          "-U",
          "orvio",
          "-d",
          "orvio_test",
        );
        ready = true;
        break;
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
    assert(ready, "Disposable PostgreSQL did not start within 30 seconds");
  }

  phase = "validate-test-target";
  const target = new URL(url);
  assert(
    ["localhost", "127.0.0.1", "[::1]"].includes(target.hostname),
    "Tests require a loopback database",
  );
  assert.equal(
    target.pathname,
    "/orvio_test",
    "Tests require the disposable orvio_test database",
  );
  ({ client } = createNodeClient(url));
  phase = "node-connectivity";
  await client.connect();
  connected = true;
  const version = Number(
    (await client.query("SHOW server_version_num")).rows[0].server_version_num,
  );
  assert(
    version >= 180000 && version < 190000,
    "Tests must use PostgreSQL 18, matching Neon",
  );
  phase = "empty-migration-journal";
  await migrateDatabase(url, "packages/db/migrations");

  // Synthetic migration fixtures exercise the real runner without business tables.
  await mkdir(path.join(folder, "meta"));
  const first = {
    idx: 0,
    version: "7",
    when: 1700000000000,
    tag: "0000_probe",
    breakpoints: true,
  };
  const journal = { version: "7", dialect: "postgresql", entries: [first] };
  await writeFile(
    path.join(folder, "meta/_journal.json"),
    JSON.stringify(journal),
  );
  await writeFile(
    path.join(folder, "0000_probe.sql"),
    `CREATE SCHEMA "${schema}";\n--> statement-breakpoint\nCREATE TABLE "${schema}".probe (id integer PRIMARY KEY);\n--> statement-breakpoint\nINSERT INTO "${schema}".probe VALUES (1);`,
  );
  phase = "migration-apply";
  await migrateDatabase(url, folder, journalSchema);
  phase = "migration-idempotency";
  await migrateDatabase(url, folder, journalSchema);
  assert.equal(
    (await client.query(`SELECT count(*)::int AS count FROM "${schema}".probe`))
      .rows[0].count,
    1,
  );
  assert.equal(
    (
      await client.query(
        `SELECT count(*)::int AS count FROM "${journalSchema}".__drizzle_migrations`,
      )
    ).rows[0].count,
    1,
  );

  journal.entries.push({
    ...first,
    idx: 1,
    when: 1700000000001,
    tag: "0001_failure",
  });
  await writeFile(
    path.join(folder, "meta/_journal.json"),
    JSON.stringify(journal),
  );
  await writeFile(
    path.join(folder, "0001_failure.sql"),
    `CREATE TABLE "${schema}".must_rollback (id integer);\n--> statement-breakpoint\nSELECT missing_function_for_failure_test();`,
  );
  phase = "migration-rollback";
  await assert.rejects(migrateDatabase(url, folder, journalSchema));
  assert.equal(
    (
      await client.query("SELECT to_regclass($1) AS relation", [
        `${schema}.must_rollback`,
      ])
    ).rows[0].relation,
    null,
  );
  assert.equal(
    (
      await client.query(
        `SELECT count(*)::int AS count FROM "${journalSchema}".__drizzle_migrations`,
      )
    ).rows[0].count,
    1,
  );

  phase = "rust-connectivity";
  const rust = spawnSync(
    "cargo",
    [
      "run",
      "--locked",
      "-q",
      "-p",
      "orvio-aggregator",
      "--",
      "doctor",
      "--database",
    ],
    {
      env: { ...process.env, DATABASE_URL_UNPOOLED: url },
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 120_000,
    },
  );
  await writeFile(
    path.join(artifacts, "rust.log"),
    `${rust.stdout ?? ""}${rust.stderr ?? ""}`,
  );
  assert.equal(rust.status, 0, "Rust connectivity diagnostic failed");
  const summary = {
    status: "passed",
    postgresMajor: 18,
    checks: [
      "node-connectivity",
      "migration-apply",
      "migration-idempotency",
      "migration-rollback",
      "rust-connectivity",
    ],
  };
  await writeFile(
    path.join(artifacts, "result.json"),
    JSON.stringify(summary, null, 2),
  );
  console.log(JSON.stringify(summary));
} catch (error) {
  // Driver messages can carry secrets. The phase identifies the failing invariant.
  await writeFile(
    path.join(artifacts, "result.json"),
    JSON.stringify({
      status: "failed",
      phase,
      kind: error instanceof Error ? error.name : "unknown",
    }),
  );
  console.error(
    `Database integration failed at ${phase}. Inspect ${artifacts}.`,
  );
  process.exitCode = 1;
} finally {
  try {
    if (client && connected) {
      await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      await client.query(`DROP SCHEMA IF EXISTS "${journalSchema}" CASCADE`);
    }
  } catch {
    console.error(
      "Test schema cleanup failed; inspect the disposable test database.",
    );
    process.exitCode = 1;
  } finally {
    await client?.end().catch(() => {
      process.exitCode = 1;
    });
    if (ownsContainer) {
      const logs = spawnSync("docker", ["logs", container], {
        encoding: "utf8",
        timeout: 10_000,
      });
      try {
        await writeFile(
          path.join(artifacts, "postgres.log"),
          `${logs.stdout ?? ""}${logs.stderr ?? ""}`,
        );
      } finally {
        docker("rm", "-f", container);
      }
    }
    await rm(folder, { recursive: true, force: true });
  }
}
