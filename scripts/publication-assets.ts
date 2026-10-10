import { createHash } from "node:crypto";
import {
  lstat,
  readFile,
  readdir,
  mkdir,
  copyFile,
  writeFile,
} from "node:fs/promises";
import path from "node:path";

export const FILE_LIMIT = 18_000;
export const BYTE_LIMIT = 24 * 1024 * 1024;
export type FileRecord = { bytes: number; sha256: string };
export type Manifest = { format: 1; files: Record<string, FileRecord> };
export const digest = (bytes: Uint8Array | string) =>
  createHash("sha256").update(bytes).digest("hex");
export async function validatePublication(root: string): Promise<Manifest> {
  const manifest = JSON.parse(
    await readFile(path.join(root, "manifest.json"), "utf8"),
  ) as Manifest;
  if (
    manifest.format !== 1 ||
    !manifest.files ||
    !manifest.files["publication.json"]
  )
    throw new Error("Unsupported publication manifest");
  await validateFiles(root, manifest.files);
  return manifest;
}
export async function validateFiles(
  root: string,
  files: Record<string, FileRecord>,
) {
  for (const [name, entry] of Object.entries(files)) {
    if (
      !name ||
      name.startsWith("/") ||
      name.split("/").some((part) => !part || part === ".." || part === ".") ||
      name.includes("\\")
    )
      throw new Error("Invalid publication path");
    let parent = root;
    for (const part of name.split("/").slice(0, -1)) {
      parent = path.join(parent, part);
      if ((await lstat(parent)).isSymbolicLink())
        throw new Error("Publication cannot contain symlinks");
    }
    const location = path.join(root, name);
    const stat = await lstat(location);
    if (!stat.isFile() || stat.size !== entry.bytes || stat.size > BYTE_LIMIT)
      throw new Error("Publication size mismatch");
    if (digest(await readFile(location)) !== entry.sha256)
      throw new Error("Publication checksum mismatch");
  }
}
export async function addArtifact(
  root: string,
  manifest: Manifest,
  name: string,
  bytes: Uint8Array | string,
) {
  const value = typeof bytes === "string" ? Buffer.from(bytes) : bytes;
  if (value.byteLength > BYTE_LIMIT) {
    if (value.byteLength > 4 * BYTE_LIMIT)
      throw new Error("Publication stream exceeds budget");
    const parts: string[] = [];
    for (let offset = 0; offset < value.byteLength; offset += BYTE_LIMIT) {
      const part = `${name}.parts/${parts.length}`;
      await addArtifact(
        root,
        manifest,
        part,
        value.subarray(offset, offset + BYTE_LIMIT),
      );
      parts.push(part);
    }
    await addArtifact(
      root,
      manifest,
      `${name}.parts.json`,
      JSON.stringify({ parts, sha256: digest(value) }),
    );
    return;
  }
  await mkdir(path.dirname(path.join(root, name)), { recursive: true });
  await writeFile(path.join(root, name), value);
  manifest.files[name] = { bytes: value.byteLength, sha256: digest(value) };
}
export async function fileNames(root: string, prefix = ""): Promise<string[]> {
  const entries = await readdir(path.join(root, prefix), {
    withFileTypes: true,
  });
  return (
    await Promise.all(
      entries.map(async (entry) => {
        const name = path.posix.join(prefix, entry.name);
        if (entry.isSymbolicLink())
          throw new Error("Publication cannot contain symlinks");
        return entry.isDirectory() ? fileNames(root, name) : [name];
      }),
    )
  )
    .flat()
    .sort();
}
export async function partitionPublication(
  root: string,
  output: string,
  workerBudget = 90,
) {
  const manifest = await validatePublication(root);
  const names = Object.keys(manifest.files).sort();
  const count = Math.ceil(names.length / FILE_LIMIT);
  // Reserve account capacity for entrypoints, previous deployment and staging.
  if ((count + 3) * 2 + 1 > workerBudget)
    throw new Error("Publication exceeds free account worker budget");
  await mkdir(output); // New immutable staging directory only.
  const shards = [];
  for (let i = 0; i < count; i++) {
    const files = names.slice(i * FILE_LIMIT, (i + 1) * FILE_LIMIT);
    const name = `assets-${i}`;
    for (const file of files) {
      const dest = path.join(output, name, file);
      await mkdir(path.dirname(dest), { recursive: true });
      await copyFile(path.join(root, file), dest);
    }
    shards.push({
      name,
      first: files[0],
      last: files.at(-1),
      files: files.length,
    });
  }
  await writeFile(
    path.join(output, "shards.json"),
    JSON.stringify({
      format: 1,
      publication: digest(JSON.stringify(manifest)),
      shards,
    }),
  );
  return shards;
}

export async function readArtifact(
  root: string,
  name: string,
): Promise<Buffer> {
  try {
    return await readFile(path.join(root, name));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    const metadata = JSON.parse(
      await readFile(path.join(root, `${name}.parts.json`), "utf8"),
    ) as { parts: string[] };
    if (
      !Array.isArray(metadata.parts) ||
      metadata.parts.length > 4 ||
      metadata.parts.some(
        (p) => !p.startsWith(`${name}.parts/`) || p.includes(".."),
      )
    )
      throw new Error("Invalid publication stream");
    return Buffer.concat(
      await Promise.all(
        metadata.parts.map((p) => readFile(path.join(root, p))),
      ),
    );
  }
}
