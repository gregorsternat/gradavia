import { mkdir, open, writeFile, readFile, copyFile } from "node:fs/promises";
import { join } from "node:path";
import {
  validatePublication,
  digest,
  addArtifact,
  partitionPublication,
  type Manifest,
} from "./publication-assets";
type Entry = {
  pack: string;
  offset: number;
  bytes: number;
  sha256: string;
  packBytes: number;
};
/** A deterministic byte archive avoids one Worker asset per retained HTML/RSC row. */
export async function packPublication(
  root: string,
  output: string,
  workerBudget = 90,
) {
  const source = await validatePublication(root);
  if (!source.files["pages.json"]) throw new Error("Prerender before packing");
  const runtime = Object.fromEntries(
    Object.entries(source.files)
      .filter(([name]) => name.startsWith("runtime/"))
      .map(([name, record]) => [name.slice(8), record]),
  );
  if (!runtime["api/index.js"] || !runtime["web/index.js"])
    throw new Error("Prerender with frozen runtime before packing");
  await mkdir(output);
  for (const name of Object.keys(runtime)) {
    const dest = join(output, "runtime", name);
    await mkdir(join(dest, ".."), { recursive: true });
    await copyFile(join(root, "runtime", name), dest);
  }
  const packed = join(output, "archive");
  await mkdir(join(packed, "packs"), { recursive: true });
  const lookups = new Map<string, Record<string, Entry>>();
  const manifest: Manifest = { format: 1, files: {} };
  let part = -1,
    offset = 0;
  let handle: Awaited<ReturnType<typeof open>> | undefined;
  let pack = "";
  let packEntries: Entry[] = [];
  async function closePack() {
    if (!handle) return;
    await handle.close();
    handle = undefined;
    const bytes = await readFile(join(packed, pack));
    for (const entry of packEntries) entry.packBytes = bytes.length;
    packEntries = [];
    manifest.files[pack] = { bytes: bytes.length, sha256: digest(bytes) };
  }
  try {
    for (const [name, entry] of Object.entries(source.files).sort(([a], [b]) =>
      a < b ? -1 : a > b ? 1 : 0,
    )) {
      const bytes = await readFile(join(root, name));
      if (!bytes.length) throw new Error("Empty artifact cannot be published");
      if (!handle || offset + bytes.length > 256 * 1024) {
        await closePack();
        part++;
        offset = 0;
        pack = `packs/${String(part).padStart(6, "0")}.bin`;
        handle = await open(join(packed, pack), "wx");
      }
      await handle.writeFile(bytes);
      const key = digest(name),
        prefix = key.slice(0, 3);
      const map = lookups.get(prefix) ?? {};
      lookups.set(prefix, map);
      map[key] = {
        pack,
        offset,
        bytes: entry.bytes,
        sha256: entry.sha256,
        packBytes: 0,
      };
      packEntries.push(map[key]!);
      offset += bytes.length;
    }
  } finally {
    await closePack();
  }
  for (const [prefix, index] of lookups)
    await addArtifact(
      packed,
      manifest,
      `lookup/${prefix}.json`,
      JSON.stringify(index),
    );
  // The physical archive has its own manifest; logical checksums remain in the source release.
  await addArtifact(
    packed,
    manifest,
    "publication.json",
    await readFile(join(root, "publication.json")),
  );
  await writeFile(join(packed, "manifest.json"), JSON.stringify(manifest));
  const shards = await partitionPublication(
    packed,
    join(output, "shards"),
    workerBudget,
  );
  const siteSha256 = digest(JSON.stringify(source));
  const archiveSha256 = digest(JSON.stringify(manifest));
  const runtimeSha256 = digest(JSON.stringify(runtime));
  await writeFile(
    join(output, "release.json"),
    JSON.stringify({
      format: 1,
      id: digest(`${siteSha256}:${archiveSha256}:${runtimeSha256}`).slice(
        0,
        20,
      ),
      siteSha256,
      archiveSha256,
      runtime,
      dataId: JSON.parse(await readFile(join(root, "pages.json"), "utf8"))
        .publicationId,
      logicalFiles: Object.keys(source.files).length,
      physicalFiles: Object.keys(manifest.files).length,
      bytes: Object.values(source.files).reduce((sum, f) => sum + f.bytes, 0),
      shards,
    }),
  );
}
if (process.argv[1]?.endsWith("pack-publication.ts"))
  await packPublication(process.argv[2]!, process.argv[3]!);
