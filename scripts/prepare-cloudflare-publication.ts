import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, join } from "node:path";
import {
  digest,
  fileNames,
  validateFiles,
  validatePublication,
  type FileRecord,
} from "./publication-assets";

export type Release = {
  format: 1;
  id: string;
  dataId: string;
  logicalFiles: number;
  physicalFiles: number;
  bytes: number;
  siteSha256: string;
  archiveSha256: string;
  runtime: Record<string, FileRecord>;
  shards: { name: string; first: string; last: string; files: number }[];
};
export async function prepareDeployment(
  directory: string,
  previous?: { id: string; dataId: string },
) {
  const root = resolve(directory);
  const release: Release = JSON.parse(
    await readFile(join(root, "release.json"), "utf8"),
  );
  if (
    release.format !== 1 ||
    !/^[a-f0-9]{20}$/.test(release.id) ||
    !/^[a-f0-9]{20}$/.test(release.dataId) ||
    release.shards.some((s) => s.files > 18000)
  )
    throw new Error("Invalid release");
  const archive = await validatePublication(join(root, "archive"));
  if (
    release.archiveSha256 !== digest(JSON.stringify(archive)) ||
    release.id !==
      digest(
        `${release.siteSha256}:${release.archiveSha256}:${digest(JSON.stringify(release.runtime))}`,
      ).slice(0, 20)
  )
    throw new Error("Release identity mismatch");
  await validateFiles(join(root, "runtime"), release.runtime);
  if (
    (await fileNames(join(root, "runtime"))).join("\n") !==
    Object.keys(release.runtime).sort().join("\n")
  )
    throw new Error("Unexpected runtime file");
  const remaining = new Set(Object.keys(archive.files));
  for (const shard of release.shards) {
    if (!/^assets-\d+$/.test(shard.name)) throw new Error("Invalid shard name");
    const files = await fileNames(join(root, "shards", shard.name));
    if (
      files.length !== shard.files ||
      files[0] !== shard.first ||
      files.at(-1) !== shard.last ||
      files.some((file) => !remaining.delete(file))
    )
      throw new Error("Invalid shard inventory");
    await validateFiles(
      join(root, "shards", shard.name),
      Object.fromEntries(files.map((file) => [file, archive.files[file]!])),
    );
  }
  if (remaining.size) throw new Error("Missing publication shard");
  const prefix = `gradavia-${release.id}`;
  const configDir = join(root, "configs");
  await mkdir(configDir, { recursive: true });
  const common = {
    account_id: "aa772cd6962f92be034156b7855f6d62",
    compatibility_date: "2026-10-01",
    workers_dev: false,
    preview_urls: false,
    observability: { enabled: true, redact_query_string: true },
  };
  const configs: string[] = [];
  const write = async (file: string, config: object) => {
    const dest = join(configDir, `${file}.json`);
    await writeFile(dest, JSON.stringify({ ...common, ...config }, null, 2));
    configs.push(dest);
    return dest;
  };
  for (const [i, shard] of release.shards.entries())
    await write(`assets-${i}`, {
      name: `${prefix}-s${i}`,
      assets: {
        directory: join(root, "shards", shard.name),
        html_handling: "none",
        not_found_handling: "none",
      },
    });
  await write("publication", {
    name: `${prefix}-data`,
    main: join(root, "runtime/publication/asset-service.js"),
    no_bundle: true,
    services: release.shards.map((_, i) => ({
      binding: `SHARD_${i}`,
      service: `${prefix}-s${i}`,
    })),
    vars: {
      SHARDS: JSON.stringify(
        release.shards.map((s, i) => ({
          binding: `SHARD_${i}`,
          first: s.first,
          last: s.last,
        })),
      ),
    },
  });
  await write("api", {
    name: `${prefix}-api`,
    main: join(root, "runtime/api/index.js"),
    no_bundle: true,
    rules: [{ type: "CompiledWasm", globs: ["**/*.wasm"], fallthrough: true }],
    services: [{ binding: "PUBLICATION", service: `${prefix}-data` }],
  });
  await write("web", {
    name: `${prefix}-web`,
    main: join(root, "runtime/web/index.js"),
    no_bundle: true,
    services: [
      { binding: "PUBLICATION", service: `${prefix}-data` },
      { binding: "GRADAVIA_API", service: `${prefix}-api` },
    ],
  });
  const stage = [...configs];
  const gateway = await write("gateway", {
    name: "gradavia-web",
    main: join(root, "runtime/gateway/gateway.js"),
    no_bundle: true,
    services: [
      { binding: "CURRENT", service: `${prefix}-web` },
      ...(previous
        ? [{ binding: "PREVIOUS", service: `gradavia-${previous.id}-web` }]
        : []),
    ],
    vars: {
      CURRENT_ID: release.dataId,
      ...(previous ? { PREVIOUS_ID: previous.dataId } : {}),
    },
    routes: ["gradavia.com", "www.gradavia.com"].map((pattern) => ({
      pattern,
      custom_domain: true,
      zone_id: "ecced0ef0eb47a53c3377130ff87820e",
    })),
  });
  await writeFile(
    join(root, "deployment.json"),
    JSON.stringify({ release, stage, gateway }, null, 2),
  );
  return { release, stage, gateway };
}
if (process.argv[1]?.endsWith("prepare-cloudflare-publication.ts")) {
  const previous = process.env.GRADAVIA_PREVIOUS_RELEASE
    ? (JSON.parse(
        await readFile(process.env.GRADAVIA_PREVIOUS_RELEASE, "utf8"),
      ) as Release)
    : undefined;
  await prepareDeployment(process.argv[2]!, previous);
}
