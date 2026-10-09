import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { createTestDatabase } from "./test-postgres";
import { migrateDatabase } from "../packages/db/src/migrate";
import { seedFormations } from "./seed-formations";
import {
  startApi,
  startProcess,
  startPublicationApi,
  webEnvironment,
} from "./runtime";

const artifacts = resolve(".artifacts/publication", randomUUID());
await mkdir(artifacts, { recursive: true });
const database = await createTestDatabase(artifacts);
let api: Awaited<ReturnType<typeof startApi>> | undefined;
let published: Awaited<ReturnType<typeof startProcess>> | undefined;
try {
  await migrateDatabase(database.url, "packages/db/migrations");
  await seedFormations(database.url);
  api = await startApi(database.url, artifacts);
  const output = resolve(artifacts, "data");
  const exporter = await startProcess(
    resolve("target/debug/gradavia-publish"),
    ["--output", output],
    { ...webEnvironment(""), DATABASE_URL: database.url },
    resolve(artifacts, "export.log"),
  );
  assert.equal(await exporter.closed, 0, "Publication export failed");
  const manifest = JSON.parse(
    await readFile(resolve(output, "manifest.json"), "utf8"),
  );
  assert.equal(manifest.format, 1);
  assert(Object.keys(manifest.files).length > 25);
  const reader = await startPublicationApi(output, artifacts);
  published = reader;
  const origin = reader.url;
  const baseline = await (await fetch(`${api.url}/v1/formations`)).json();
  const years = baseline.data.campaigns as number[];
  let checks = 0;
  async function parity(path: string) {
    const expected = await fetch(api!.url + path);
    const actual = await fetch(origin + path);
    assert.equal(actual.status, expected.status, path);
    assert.deepEqual(await actual.json(), await expected.json(), path);
    checks++;
  }
  for (const year of years)
    for (const query of [
      "",
      "q=lycee",
      "q=%25",
      "q=_",
      "q=coeur",
      "q=%C5%93",
      "q=introuvable",
      "page=999",
      "tri=capacite",
      "tri=candidatures",
      "tri=admis",
      "tri=acces",
      "region=invalid",
      "statut=Public",
      "selectivite=Non+s%C3%A9lective",
      "q=a+e&page=2",
    ]) {
      const path = `/v1/formations?campagne=${year}&${query}`;
      await parity(path);
    }
  for (const path of [
    "/v1/sources",
    "/v1/overview",
    "/v1/atlas",
    "/v1/atlas?famille=apprentissage",
    "/v1/atlas?famille=apb",
    `/v1/formations/${baseline.data.formations[0].id}`,
    `/v1/atlas/formations/${baseline.data.formations[0].id}`,
  ]) {
    await parity(path);
  }
  const publication = JSON.parse(
    await readFile(resolve(output, "publication.json"), "utf8"),
  );
  for (const ref of publication.atlases) {
    const query = new URLSearchParams({
      famille: ref.family,
      campagne: String(ref.campaign),
      version: ref.releaseId,
    });
    await parity(`/v1/atlas?${query}`);
  }
  for (const [pair, groups] of Object.entries(publication.specialties.groups)) {
    for (const group of ["", ...(groups as string[])])
      await parity(
        `/v1/specialties?${new URLSearchParams({ paire: pair, groupe: group })}`,
      );
  }
  for (const formation of ["", "unknown", ...publication.inverse])
    await parity(
      `/v1/specialties/inverse?${new URLSearchParams({ formation })}`,
    );
  for (const path of [
    "/v1/formations?campagne=1900",
    "/v1/formations?campagne=invalid",
    "/v1/formations?page=-1",
    "/v1/formations?tri=invalid",
    "/v1/overview?campagne=1900",
    "/v1/overview?region=invalid",
    "/v1/atlas?famille=invalid",
    "/v1/atlas?campagne=1900",
    "/v1/atlas?version=invalid",
    "/v1/formations/invalid",
    "/v1/atlas/formations/invalid",
    "/v1/formations/11111111-1111-1111-1111-111111111111:1",
    "/v1/specialties?paire=unknown&groupe=unknown",
    "/v1/specialties?groupe=unknown",
    `/v1/formations?q=${"x".repeat(16_400)}`,
  ])
    await parity(path);
  // A completed publication is never overwritten, including on an accidental retry.
  assert.throws(() =>
    execFileSync(
      resolve("target/debug/gradavia-publish"),
      ["--output", output],
      {
        env: { ...webEnvironment(""), DATABASE_URL: database.url },
        stdio: "pipe",
      },
    ),
  );
  console.log(
    `Publication parity: ${checks} HTTP contracts passed. Artifacts: ${artifacts}`,
  );
} finally {
  await published?.stop();
  await api?.stop();
  await database.close();
}
