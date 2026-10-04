import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { parse } from "dotenv";

/** An explicit development datasource changes API reads, never migration targets. */
export async function developmentDatabase(
  environment: NodeJS.ProcessEnv,
): Promise<string | undefined> {
  if (!environment.ORVIO_DATA_ENV_FILE) return environment.DATABASE_URL;
  try {
    const selected = parse(
      await readFile(environment.ORVIO_DATA_ENV_FILE, "utf8"),
    );
    if (!selected.DATABASE_URL)
      throw new Error("Missing development datasource");
    return selected.DATABASE_URL;
  } catch {
    throw new Error("Selected development datasource is unavailable");
  }
}

export function webEnvironment(origin: string): NodeJS.ProcessEnv {
  const env = {
    ...process.env,
    ORVIO_API_URL: origin,
    NEXT_TELEMETRY_DISABLED: "1",
  };
  for (const key of [
    "DATABASE_URL",
    "DATABASE_URL_UNPOOLED",
    "TEST_DATABASE_URL",
    "ORVIO_TEST_DATABASE_URL",
    "ORVIO_DATA_ENV_FILE",
  ])
    delete env[key as keyof typeof env];
  return env;
}

export async function startProcess(
  command: string,
  args: string[],
  env: NodeJS.ProcessEnv,
  logPath: string,
) {
  await mkdir(path.dirname(logPath), { recursive: true });
  const log = createWriteStream(logPath);
  const child = spawn(command, args, {
    env,
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.pipe(log, { end: false });
  child.stderr.pipe(log, { end: false });
  const closed = new Promise<number>((resolve) => {
    child.once("error", () => {
      log.end();
      resolve(1);
    });
    child.once("close", (code) => {
      log.end();
      resolve(code ?? 0);
    });
  });
  let stopping: Promise<void> | undefined;
  function stop() {
    return (stopping ??= (async () => {
      const signal = (value: NodeJS.Signals) => {
        try {
          if (child.pid) process.kill(-child.pid, value);
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
        }
      };
      signal("SIGTERM");
      const force = setTimeout(() => signal("SIGKILL"), 15_000);
      try {
        await closed;
      } finally {
        clearTimeout(force);
      }
    })());
  }
  return { child, closed, stop };
}

export async function startApi(
  databaseUrl: string,
  artifacts: string,
  bind = "127.0.0.1:0",
) {
  const api = await startProcess(
    path.resolve("target/debug/orvio-api"),
    [],
    {
      ...process.env,
      DATABASE_URL: databaseUrl,
      DATABASE_URL_UNPOOLED: "",
      API_BIND: bind,
    },
    path.join(artifacts, "api.log"),
  );
  try {
    const address = await new Promise<string>((resolve, reject) => {
      let pending = "";
      const timer = setTimeout(
        () => reject(new Error("API startup timed out")),
        15_000,
      );
      api.closed.then(() => {
        clearTimeout(timer);
        reject(new Error("API exited during startup"));
      });
      api.child.stderr.on("data", (chunk: Buffer) => {
        pending += chunk.toString();
        const lines = pending.split("\n");
        pending = lines.pop()!;
        for (const line of lines) {
          try {
            const event = JSON.parse(line);
            if (event.fields?.event === "api_listening") {
              clearTimeout(timer);
              resolve(event.fields.address);
            }
          } catch {
            /* Only structured startup diagnostics are inspected. */
          }
        }
      });
    });
    const url = new URL(`http://${address}`);
    if (url.hostname === "0.0.0.0") url.hostname = "127.0.0.1";
    if (url.hostname === "[::]") url.hostname = "[::1]";
    return { ...api, url: url.origin };
  } catch (error) {
    await api.stop();
    throw error;
  }
}
