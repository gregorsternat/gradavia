import path from "node:path";
import { startApi, startProcess, webEnvironment } from "./runtime";

const artifacts = path.resolve(
  process.env.ARTIFACTS_DIR ?? ".artifacts",
  "development",
);
let api: Awaited<ReturnType<typeof startApi>> | undefined;
let web: Awaited<ReturnType<typeof startProcess>> | undefined;
let stopping = false;
let cleanup: Promise<void> | undefined;
function stop() {
  stopping = true;
  return (cleanup ??= (async () => {
    await web?.stop();
    await api?.stop();
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
  if (process.env.DATABASE_URL) {
    api = await startApi(
      process.env.DATABASE_URL,
      artifacts,
      process.env.API_BIND ?? "127.0.0.1:3002",
    );
    console.log(`Rust API: ${api.url}`);
  }
  if (stopping) throw new Error("Startup interrupted");
  web = await startProcess(
    "pnpm",
    ["--filter", "@orvio/web", "dev"],
    webEnvironment(api?.url ?? process.env.ORVIO_API_URL ?? ""),
    path.join(artifacts, "web.log"),
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
    console.error(
      "Development startup failed. Inspect .artifacts/development.",
    );
    process.exitCode = 1;
  }
} finally {
  await stop();
}
