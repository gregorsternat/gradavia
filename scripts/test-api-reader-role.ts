import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { createNodeClient } from "../packages/db/src/node";
import { createApiReaderRole } from "./api-reader-role";

/** Exercises actual PostgreSQL privileges independently of API transactions. */
export async function testApiReaderRole(connection: string) {
  const role = `reader_${randomUUID().replaceAll("-", "")}`;
  const password = randomBytes(32).toString("hex");
  const admin = createNodeClient(connection).client;
  const target = new URL(connection);
  target.username = role;
  target.password = password;
  const reader = createNodeClient(target.toString()).client;
  let created = false;
  try {
    await admin.connect();
    await createApiReaderRole(admin, password, role);
    created = true;
    await reader.connect();
    assert.equal(
      (await reader.query("SHOW default_transaction_read_only")).rows[0]
        .default_transaction_read_only,
      "on",
    );
    // Prove permissions, not only the mutable read-only connection default.
    await reader.query("SET default_transaction_read_only = off");
    for (const table of ["source_datasets", "source_releases", "raw_records"]) {
      await reader.query(`SELECT 1 FROM public.${table} LIMIT 1`);
      await assert.rejects(
        reader.query(`DELETE FROM public.${table} WHERE false`),
        { code: "42501" },
      );
    }
    for (const sql of [
      "CREATE TABLE public.api_role_must_not_create (id integer)",
      "SELECT 1 FROM public.ingestion_runs LIMIT 1",
      "SELECT 1 FROM drizzle.__drizzle_migrations LIMIT 1",
      `ALTER TABLE public.source_datasets OWNER TO ${role}`,
    ]) {
      await assert.rejects(reader.query(sql), { code: "42501" });
    }
    await assert.rejects(createApiReaderRole(admin, password, role), {
      code: "42710",
    });
    await reader.query("SELECT 1 FROM public.source_datasets LIMIT 1");
  } finally {
    await reader.end();
    if (created) {
      await admin.query(`DROP OWNED BY "${role}"`);
      await admin.query(`DROP ROLE "${role}"`);
    }
    await admin.end();
  }
}
