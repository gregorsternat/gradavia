import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { open, readFile } from "node:fs/promises";
import { parseArgs, parseEnv } from "node:util";
import { validateDatabaseUrl } from "../packages/db/src/config";
import { createNodeClient } from "../packages/db/src/node";
import { apiReaderRole, createApiReaderRole } from "./api-reader-role";

let client: ReturnType<typeof createNodeClient>["client"] | undefined;
let phase = "configuration";

try {
  const { values } = parseArgs({
    options: {
      "env-file": { type: "string" },
      "confirm-endpoint": { type: "string" },
      apply: { type: "boolean", default: false },
    },
  });
  assert(values["env-file"], "An explicit environment file is required");
  const env = parseEnv(await readFile(values["env-file"], "utf8"));
  const direct = new URL(validateDatabaseUrl(env.DATABASE_URL_UNPOOLED, true));
  const pooled = new URL(validateDatabaseUrl(env.DATABASE_URL));
  const endpoint = direct.hostname.replace(/-pooler(?=\.)/, "");
  assert.equal(pooled.hostname.replace(/-pooler(?=\.)/, ""), endpoint);
  assert.equal(pooled.pathname, direct.pathname);
  if (direct.hostname.endsWith(".neon.tech")) {
    direct.searchParams.set("sslmode", "verify-full");
    pooled.searchParams.set("sslmode", "verify-full");
  }
  client = createNodeClient(direct.toString()).client;
  phase = "inspect-target";
  await client.connect();
  const result = await client.query(
    "SELECT current_database() AS database, EXISTS (SELECT 1 FROM pg_roles WHERE rolname=$1) AS role_exists",
    [apiReaderRole],
  );
  console.log(
    JSON.stringify({
      event: "api_reader_target",
      endpoint: endpoint.split(".")[0],
      ...result.rows[0],
      apply: values.apply,
      publicPrivileges: "Existing PUBLIC CONNECT and TEMPORARY are preserved",
    }),
  );
  if (values.apply) {
    assert.equal(values["confirm-endpoint"], endpoint.split(".")[0]);
    assert(
      !result.rows[0].role_exists,
      "Existing API roles require manual review",
    );
    const current = await readFile(".env.local", "utf8").catch(
      (error: NodeJS.ErrnoException) => {
        if (error.code === "ENOENT") return "";
        throw error;
      },
    );
    assert(
      !("GRADAVIA_API_DATABASE_URL" in parseEnv(current)),
      "An existing API credential must not be overwritten",
    );
    // Open the ignored output before creating the role to detect local write
    // failures early. Only this generated runtime credential is appended.
    const output = await open(".env.local", "a", 0o600);
    try {
      await output.chmod(0o600);
      const password = randomBytes(32).toString("hex");
      phase = "create-reader";
      await createApiReaderRole(client, password);
      pooled.username = apiReaderRole;
      pooled.password = password;
      phase = "save-runtime-credential";
      await output.writeFile(
        `\nGRADAVIA_API_DATABASE_URL=${pooled.toString()}\n`,
      );
      console.log(
        JSON.stringify({ event: "api_reader_created", role: apiReaderRole }),
      );
    } finally {
      await output.close();
    }
  }
} catch {
  // Never emit a driver/parser error or credentials, including on failed DDL.
  console.error(JSON.stringify({ event: "api_reader_failed", phase }));
  process.exitCode = 1;
} finally {
  await client?.end().catch(() => {
    process.exitCode = 1;
  });
}
