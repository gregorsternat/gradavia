import assert from "node:assert/strict";
import { test } from "node:test";
import { webEnvironment } from "../runtime.ts";

test("the web process only receives the API origin, never database credentials", () => {
  const keys = [
    "DATABASE_URL",
    "DATABASE_URL_UNPOOLED",
    "TEST_DATABASE_URL",
    "ORVIO_TEST_DATABASE_URL",
  ];
  const previous = keys.map((key) => process.env[key]);
  try {
    for (const key of keys) process.env[key] = "test-only-secret";
    const env = webEnvironment("http://127.0.0.1:3002");
    for (const key of keys) assert.equal(env[key], undefined);
    assert.equal(env.ORVIO_API_URL, "http://127.0.0.1:3002");
  } finally {
    keys.forEach((key, index) => {
      if (previous[index] === undefined) delete process.env[key];
      else process.env[key] = previous[index];
    });
  }
});
