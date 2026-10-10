import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { digest, fileNames, type FileRecord } from "./publication-assets";
import { startProcess, webEnvironment } from "./runtime";

/** Freeze executable bundles as well as data, so rollback never rebuilds code. */
export async function snapshotRuntime(output: string) {
  const root = resolve(output, "runtime");
  await mkdir(root);
  for (const [name, entry] of [
    ["publication", "asset-service.ts"],
    ["web", "index.ts"],
    ["gateway", "gateway.ts"],
  ]) {
    const config = join(output, `bundle-${name}.json`);
    await writeFile(
      config,
      JSON.stringify({
        name: `gradavia-build-${name}`,
        compatibility_date: "2026-10-01",
        main: resolve("apps/free-web/src", entry!),
      }),
    );
    const build = await startProcess(
      "pnpm",
      [
        "--filter",
        "@gradavia/free-web",
        "exec",
        "wrangler",
        "deploy",
        "--config",
        resolve(config),
        "--dry-run",
        "--outdir",
        join(root, name!),
      ],
      webEnvironment(""),
      join(output, `bundle-${name}.log`),
    );
    if ((await build.closed) !== 0)
      throw new Error("Runtime bundle failed; inspect publication artifacts");
  }
  await mkdir(join(root, "api"));
  for (const file of await fileNames(resolve(".artifacts/wasm"))) {
    if (!/\.(js|wasm)$/.test(file)) continue;
    const dest = join(root, "api", file);
    await mkdir(join(dest, ".."), { recursive: true });
    await copyFile(resolve(".artifacts/wasm", file), dest);
  }
  const files: Record<string, FileRecord> = {};
  for (const file of await fileNames(root)) {
    const bytes = await readFile(join(root, file));
    files[file] = { bytes: bytes.length, sha256: digest(bytes) };
  }
  return files;
}
