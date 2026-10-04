import assert from "node:assert/strict";
import { spawn } from "node:child_process";

try {
  const value = process.env.GRADAVIA_API_DATABASE_URL;
  assert(value, "Runtime credential required");
  const url = new URL(value);
  assert(["postgres:", "postgresql:"].includes(url.protocol));
  assert.equal(url.username, "gradavia_api");
  assert(url.password && url.pathname.length > 1);
  const env = { ...process.env };
  for (const key of [
    "DATABASE_URL",
    "DATABASE_URL_UNPOOLED",
    "GRADAVIA_API_DATABASE_URL",
    "GRADAVIA_DATA_ENV_FILE",
    "GRADAVIA_API_URL",
  ])
    delete env[key];
  const child = spawn(
    "pnpm",
    [
      "--filter",
      "@gradavia/api-worker",
      "exec",
      "wrangler",
      "secret",
      "put",
      "DATABASE_URL",
    ],
    { env, stdio: ["pipe", "inherit", "inherit"] },
  );
  child.stdin.on("error", () => {});
  child.stdin.end(value);
  process.exitCode = await new Promise((resolve) => {
    child.on("error", () => resolve(1));
    child.on("exit", (code) => resolve(code ?? 1));
  });
} catch {
  console.error(
    "API secret upload failed. Check the dedicated reader configuration.",
  );
  process.exitCode = 1;
}
