import { spawn } from "node:child_process";
import { createWriteStream, mkdirSync } from "node:fs";
import path from "node:path";

const production = process.env.E2E_PRODUCTION === "1";
const artifacts = path.resolve(
  process.env.ARTIFACTS_DIR ?? ".artifacts",
  production ? "browser-production" : "browser-development",
);
mkdirSync(artifacts, { recursive: true });
const log = createWriteStream(path.join(artifacts, "server.log"));
const child = spawn(
  "pnpm",
  [
    "--filter",
    "@orvio/web",
    production ? "start" : "dev",
    "--port",
    process.env.E2E_PORT ?? (production ? "3101" : "3100"),
  ],
  {
    env: {
      ...process.env,
      DATABASE_URL: "",
      DATABASE_URL_UNPOOLED: "",
      NEXT_TELEMETRY_DISABLED: "1",
    },
    stdio: ["ignore", "pipe", "pipe"],
  },
);
child.stdout.pipe(log, { end: false });
child.stderr.pipe(log, { end: false });
child.stdout.pipe(process.stdout);
child.stderr.pipe(process.stderr);
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, () => child.kill(signal));
child.on("error", (error) => {
  log.end(String(error));
  process.exitCode = 1;
});
child.on("close", (code) => {
  log.end();
  process.exitCode = code ?? 0;
});
