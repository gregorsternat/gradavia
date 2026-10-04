import assert from "node:assert/strict";
import { createNodeClient } from "../packages/db/src/node";

type Client = ReturnType<typeof createNodeClient>["client"];
export const apiReaderRole = "gradavia_api";
const readTables = ["source_datasets", "source_releases", "raw_records"];
const identifier = (value: string) => `"${value.replaceAll('"', '""')}"`;

/** SQL-created roles receive no Neon administrative memberships. */
export async function createApiReaderRole(
  client: Client,
  password: string,
  role = apiReaderRole,
) {
  assert(/^[a-z][a-z0-9_]{0,62}$/.test(role), "Invalid API role name");
  assert(/^[a-f0-9]{64}$/.test(password), "Expected a generated API password");
  await client.query("BEGIN");
  try {
    const database = (await client.query("SELECT current_database() AS name"))
      .rows[0].name as string;
    // An existing role is never changed or silently rotated by provisioning.
    await client.query(
      `CREATE ROLE ${identifier(role)} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS PASSWORD '${password}'`,
    );
    await client.query(
      `GRANT CONNECT ON DATABASE ${identifier(database)} TO ${identifier(role)}`,
    );
    await client.query(`GRANT USAGE ON SCHEMA public TO ${identifier(role)}`);
    await client.query(
      `GRANT SELECT ON ${readTables.map((table) => `public.${identifier(table)}`).join(", ")} TO ${identifier(role)}`,
    );
    await client.query(
      `ALTER ROLE ${identifier(role)} SET default_transaction_read_only = on`,
    );
    await client.query(
      `ALTER ROLE ${identifier(role)} SET statement_timeout = '15s'`,
    );

    // Defaults are defense in depth: effective privileges enforce write denial
    // even if a client disables default_transaction_read_only. PUBLIC grants
    // remain untouched; unexpected existing grants make this transaction fail.
    const checks = await client.query(
      `SELECT
        NOT has_database_privilege($1, current_database(), 'CREATE') AS no_database_create,
        NOT EXISTS (SELECT 1 FROM pg_namespace n
          WHERE n.nspname NOT LIKE 'pg_%' AND n.nspname <> 'information_schema'
          AND has_schema_privilege($1, n.oid, 'CREATE')) AS no_schema_create,
        NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
          WHERE n.nspname NOT LIKE 'pg_%' AND n.nspname <> 'information_schema'
          AND c.relkind IN ('r','v','m','p','f')
          AND (has_table_privilege($1,c.oid,'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
            OR (has_table_privilege($1,c.oid,'SELECT')
              AND NOT (n.nspname='public' AND c.relname=ANY($2::text[]))))) AS only_expected_table_grants,
        NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
          WHERE n.nspname NOT LIKE 'pg_%' AND n.nspname <> 'information_schema'
          AND p.prosecdef AND has_function_privilege($1,p.oid,'EXECUTE')) AS no_privileged_functions,
        NOT EXISTS (SELECT 1 FROM pg_auth_members m JOIN pg_roles r ON r.oid=m.member
          WHERE r.rolname=$1) AS no_memberships`,
      [role, readTables],
    );
    assert(
      Object.values(checks.rows[0]).every((value) => value === true),
      "Existing PUBLIC privileges exceed the API role contract",
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  }
}
