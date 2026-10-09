import assert from "node:assert/strict";
import {
  datasetCsv,
  datasetMetadata,
} from "../apps/web/src/features/atlas/domain/export";
import { atlasResponse } from "../apps/web/src/features/atlas/domain/api-contract";
import { readArtifact } from "./publication-assets";
import type { Publication } from "../apps/free-web/src/publication";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { packPublication } from "./pack-publication";
import { prepareDeployment } from "./prepare-cloudflare-publication";
import { startProcess, webEnvironment } from "./runtime";
const artifacts = resolve(".artifacts/publication-verification", randomUUID());
async function run(file: string, args: string[] = []) {
  const child = await startProcess(
    "pnpm",
    ["exec", "tsx", `scripts/${file}.ts`, ...args],
    webEnvironment(""),
    `${artifacts}-${file}.log`,
  );
  if ((await child.closed) !== 0)
    throw new Error(`Publication ${file} failed; inspect artifacts`);
}
await run("prepare-publication-fixtures");
const data = (
  await readFile(".artifacts/publication-fixture-path", "utf8")
).trim();
await run("prerender-publication", [data]);
const rendered = `${data}-web`;
await packPublication(rendered, artifacts);
const { stage } = await prepareDeployment(artifacts);
const web = stage.find((config) => config.endsWith("/web.json"))!;
const port = process.env.E2E_PORT ?? "3597";
const worker = await startProcess(
  "pnpm",
  [
    "--filter",
    "@gradavia/free-web",
    "exec",
    "wrangler",
    "dev",
    "--port",
    port,
    ...[web, ...stage.filter((config) => config !== web)].flatMap((config) => [
      "--config",
      config,
    ]),
  ],
  webEnvironment(""),
  join(artifacts, "workerd.log"),
);
try {
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try {
      const result = (await (
        await fetch(`http://127.0.0.1:${port}/api/workspace/formations`)
      ).json()) as { result?: { status: string } };
      if (result.result?.status === "ready") {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  if (!ready)
    throw new Error("Fixture Cloudflare publication did not become ready");
  const publication: Publication = JSON.parse(
    await readFile(join(rendered, "publication.json"), "utf8"),
  );
  for (const ref of publication.atlases) {
    const result = atlasResponse.parse(
      JSON.parse(
        (
          await readArtifact(
            rendered,
            `atlas/${ref.family}/${ref.releaseId}/${ref.campaign}.json`,
          )
        ).toString(),
      ),
    );
    assert(result.status === "ready");
    for (const format of ["json", "metadata", "csv"]) {
      const query = new URLSearchParams({
        famille: ref.family,
        campagne: String(ref.campaign),
        version: ref.releaseId,
        format,
      });
      const response = await fetch(
        `http://127.0.0.1:${port}/api/v1/datasets?${query}`,
      );
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("access-control-allow-origin"), "*");
      assert.match(response.headers.get("cache-control")!, /immutable/);
      if (format === "csv")
        // Response.text strips the UTF-8 BOM; compare bytes to retain Excel's
        // encoding marker as well as the exact data and quoting contract.
        assert.deepEqual(
          Buffer.from(await response.arrayBuffer()),
          Buffer.from(datasetCsv(result.data)),
        );
      else
        assert.deepEqual(
          await response.json(),
          format === "metadata"
            ? datasetMetadata(result.data)
            : {
                status: "ready",
                data: { ...result.data, campaigns: [ref.campaign] },
                metadata: datasetMetadata(result.data),
              },
        );
    }
  }
  const browser = await startProcess(
    "pnpm",
    ["exec", "playwright", "test", "--workers=2"],
    {
      ...webEnvironment(""),
      E2E_PRODUCTION: "1",
      PUBLICATION_TEST_ORIGIN: `http://127.0.0.1:${port}`,
      ARTIFACTS_DIR: artifacts,
    },
    join(artifacts, "browser.log"),
  );
  if ((await browser.closed) !== 0)
    throw new Error("Publication browser parity failed; inspect artifacts");
  console.log(
    `Cloudflare/Wasm publication browser parity passed. Artifacts: ${artifacts}`,
  );
} finally {
  await worker.stop();
}
