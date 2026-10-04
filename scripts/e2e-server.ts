import path from "node:path";
import { createTestDatabase } from "./test-postgres";
import { migrateDatabase } from "../packages/db/src/migrate";
import { seedFormations } from "./seed-formations";
import { startApi, startProcess, webEnvironment } from "./runtime";

const production = process.env.E2E_PRODUCTION === "1";
const scenario = process.env.E2E_STATE ? `-${process.env.E2E_STATE}` : "";
const artifacts = path.resolve(
  process.env.ARTIFACTS_DIR ?? ".artifacts",
  `${production ? "browser-production" : "browser-development"}${scenario}`,
);
let database: Awaited<ReturnType<typeof createTestDatabase>> | undefined;
let api: Awaited<ReturnType<typeof startApi>> | undefined;
let web: Awaited<ReturnType<typeof startProcess>> | undefined;
let stopping = false;
let cleanup: Promise<void> | undefined;
function stop() {
  stopping = true;
  return (cleanup ??= (async () => {
    await web?.stop();
    await api?.stop();
    await database?.close();
  })());
}
let interrupt: (code: number) => void;
const interrupted = new Promise<number>((resolve) => {
  interrupt = resolve;
});
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.on(signal, () => {
    stopping = true;
    interrupt(0);
  });
try {
  if (process.env.E2E_STATE === "unavailable") {
    api = await startApi(
      "postgresql://unavailable@127.0.0.1:1/gradavia_test",
      artifacts,
    );
  } else if (process.env.E2E_STATE !== "unconfigured") {
    database = await createTestDatabase(artifacts);
    if (stopping) throw new Error("Startup interrupted");
    await migrateDatabase(database.url, "packages/db/migrations");
    if (process.env.E2E_STATE !== "empty") await seedFormations(database.url);
    api = await startApi(database.url, artifacts);
  }
  if (stopping) throw new Error("Startup interrupted");
  web = await startProcess(
    "pnpm",
    [
      "--filter",
      "@gradavia/web",
      production ? "start" : "dev",
      "--port",
      process.env.E2E_PORT ?? (production ? "3101" : "3100"),
    ],
    webEnvironment(api?.url ?? ""),
    path.join(artifacts, "server.log"),
  );
  web.child.stdout.pipe(process.stdout);
  web.child.stderr.pipe(process.stderr);
  const code = await Promise.race([
    interrupted,
    web.closed,
    ...(api ? [api.closed] : []),
  ]);
  if (!stopping) process.exitCode = code || 1;
} catch {
  if (!stopping) {
    console.error("Browser harness startup failed. Inspect its artifacts.");
    process.exitCode = 1;
  }
} finally {
  await stop();
}
