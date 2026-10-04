import assert from "node:assert/strict";
import { test } from "node:test";
import { webEnvironment, developmentDatabase } from "../runtime.ts";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

test("the web process only receives the API origin, never database credentials", () => {
  const keys = [
    "DATABASE_URL",
    "DATABASE_URL_UNPOOLED",
    "GRADAVIA_API_DATABASE_URL",
    "TEST_DATABASE_URL",
    "GRADAVIA_TEST_DATABASE_URL",
    "GRADAVIA_DATA_ENV_FILE",
    "ORVIO_TEST_DATABASE_URL",
    "ORVIO_DATA_ENV_FILE",
  ];
  const previous = keys.map((key) => process.env[key]);
  try {
    for (const key of keys) process.env[key] = "test-only-secret";
    const env = webEnvironment("http://127.0.0.1:3002");
    for (const key of keys) assert.equal(env[key], undefined);
    assert.equal(env.GRADAVIA_API_URL, "http://127.0.0.1:3002");
  } finally {
    keys.forEach((key, index) => {
      if (previous[index] === undefined) delete process.env[key];
      else process.env[key] = previous[index];
    });
  }
});

test("an explicitly selected development datasource never falls back to another database", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "gradavia-env-test-"));
  const filename = path.join(directory, ".env.local");
  const environment = {
    DATABASE_URL: "original-test-only",
    GRADAVIA_DATA_ENV_FILE: filename,
  };
  try {
    await writeFile(filename, "DATABASE_URL=selected-test-only\n", {
      mode: 0o600,
    });
    assert.equal(await developmentDatabase(environment), "selected-test-only");
    assert.equal(environment.DATABASE_URL, "original-test-only");
    await writeFile(filename, "PORT=9999\n");
    await assert.rejects(() => developmentDatabase(environment), {
      message: "Selected development datasource is unavailable",
    });
    assert.equal(
      await developmentDatabase({ DATABASE_URL: "default-test-only" }),
      "default-test-only",
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
