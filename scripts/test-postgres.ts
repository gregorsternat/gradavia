import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createNodeClient } from "../packages/db/src/node";

/** Own one isolated database, optionally owning its local PostgreSQL container too. */
export async function createTestDatabase(artifacts: string) {
  await mkdir(artifacts, { recursive: true });
  const id = randomUUID().replaceAll("-", "");
  const container = `orvio-test-${id}`;
  const database = `orvio_ingest_${id}`;
  let ownsContainer = false,
    ownsDatabase = false;
  let administrator: ReturnType<typeof createNodeClient>["client"] | undefined;
  const docker = (...args: string[]) =>
    execFileSync("docker", args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 120_000,
    }).trim();
  const close = async () => {
    let failed = false;
    try {
      if (ownsDatabase) {
        await administrator!.query(`DROP DATABASE "${database}" WITH (FORCE)`);
        ownsDatabase = false;
      }
    } catch {
      failed = true;
    }
    try {
      await administrator?.end();
    } catch {
      failed = true;
    }
    administrator = undefined;
    if (ownsContainer) {
      try {
        await writeFile(
          path.join(artifacts, "postgres.log"),
          docker("logs", container),
        );
      } catch {
        failed = true;
      }
      try {
        docker("rm", "-f", container);
        ownsContainer = false;
      } catch {
        failed = true;
      }
    }
    if (failed) throw new Error("Disposable PostgreSQL cleanup failed");
  };
  try {
    let url = process.env.TEST_DATABASE_URL;
    if (!url) {
      docker(
        "run",
        "--rm",
        "-d",
        "--name",
        container,
        "-e",
        "POSTGRES_USER=orvio",
        "-e",
        "POSTGRES_PASSWORD=orvio",
        "-e",
        "POSTGRES_DB=orvio_test",
        "-p",
        "127.0.0.1::5432",
        "postgres:18",
      );
      ownsContainer = true;
      url = `postgresql://orvio:orvio@${docker("port", container, "5432/tcp")}/orvio_test`;
      let ready = false;
      for (let attempt = 0; attempt < 60; attempt++) {
        try {
          docker(
            "exec",
            container,
            "pg_isready",
            "-h",
            "127.0.0.1",
            "-U",
            "orvio",
            "-d",
            "orvio_test",
          );
          ready = true;
          break;
        } catch {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }
      assert(ready, "Disposable PostgreSQL did not start within 30 seconds");
    }
    const target = new URL(url);
    assert(
      ["localhost", "127.0.0.1", "[::1]"].includes(target.hostname),
      "Tests require a loopback database",
    );
    assert.equal(
      target.pathname,
      "/orvio_test",
      "Tests require the disposable orvio_test database",
    );
    administrator = createNodeClient(url).client;
    await administrator.connect();
    const version = Number(
      (await administrator.query("SHOW server_version_num")).rows[0]
        .server_version_num,
    );
    assert(
      version >= 180000 && version < 190000,
      "Tests require PostgreSQL 18",
    );
    await administrator.query(`CREATE DATABASE "${database}"`);
    ownsDatabase = true;
    target.pathname = `/${database}`;
    return { url: target.toString(), close };
  } catch {
    await close();
    throw new Error("Disposable PostgreSQL setup failed");
  }
}
