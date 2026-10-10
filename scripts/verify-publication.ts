import assert from "node:assert/strict";
import {
  datasetCsv,
  datasetMetadata,
} from "../apps/web/src/features/atlas/domain/export";
import { atlasResponse } from "../apps/web/src/features/atlas/domain/api-contract";
import {
  readArtifact,
  addArtifact,
  addDocumentArtifact,
  type Manifest,
} from "./publication-assets";
import { pageAsset } from "../apps/free-web/src/identity";
import type { Publication } from "../apps/free-web/src/publication";
import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { request as httpRequest } from "node:http";
import { brotliDecompressSync } from "node:zlib";
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
// Small source fixtures do not naturally produce a large Flight response. Add
// a transport-only route to this disposable publication to exercise both forms.
const fixtureManifest: Manifest = JSON.parse(
  await readFile(join(rendered, "manifest.json"), "utf8"),
);
const fixturePages = JSON.parse(
  (await readArtifact(rendered, "pages.json")).toString(),
);
const probe = "/compression-probe";
const probeFiles = {
  html: await pageAsset(probe, false),
  rsc: await pageAsset(probe, true),
};
for (const [representation, name] of Object.entries(probeFiles))
  await addDocumentArtifact(
    rendered,
    fixtureManifest,
    name,
    (representation === "html"
      ? "<p>Public fixture</p>"
      : '0:{"fixture":"public"}\n'
    ).repeat(10_000),
  );
fixturePages.routes[probe] = probeFiles;
await addArtifact(
  rendered,
  fixtureManifest,
  "pages.json",
  JSON.stringify(fixturePages),
);
await writeFile(
  join(rendered, "manifest.json"),
  JSON.stringify(fixtureManifest),
);
await packPublication(rendered, artifacts);
const { stage, gateway: web } = await prepareDeployment(artifacts);
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
  // Node's raw HTTP client keeps wire bytes intact, so this exercises encoding
  // through the real asset, page and gateway Workers rather than a Response mock.
  const wire = (
    route: string,
    headers: Record<string, string>,
    method = "GET",
  ) =>
    new Promise<{
      status: number;
      headers: import("node:http").IncomingHttpHeaders;
      body: Buffer;
    }>((resolve, reject) => {
      const request = httpRequest(
        `http://127.0.0.1:${port}${route}`,
        { headers, method },
        (response) => {
          const chunks: Buffer[] = [];
          response.on("data", (chunk: Buffer) => chunks.push(chunk));
          response.on("error", reject);
          response.on("aborted", () =>
            reject(new Error("Truncated wire response")),
          );
          response.on("end", () =>
            resolve({
              status: response.statusCode!,
              headers: response.headers,
              body: Buffer.concat(chunks),
            }),
          );
        },
      );
      request.on("error", reject);
      request.setTimeout(15_000, () =>
        request.destroy(new Error("Wire response timed out")),
      );
      request.end();
    });
  const pages = JSON.parse(
    (await readArtifact(rendered, "pages.json")).toString(),
  ) as { routes: Record<string, { html: string; rsc: string }> };
  const manifest = JSON.parse(
    await readFile(join(rendered, "manifest.json"), "utf8"),
  ) as { files: Record<string, unknown> };
  for (const representation of ["html", "rsc"] as const) {
    const page = Object.entries(pages.routes).find(
      ([route, files]) =>
        !route.includes("_publication_shell") &&
        manifest.files[`${files[representation]}.br`],
    );
    assert(
      page,
      `Fixture must exercise a compressed ${representation} document`,
    );
    const [route, files] = page;
    const headers: Record<string, string> =
      representation === "rsc" ? { rsc: "1" } : {};
    const raw = await wire(route, {
      ...headers,
      "accept-encoding": "identity",
    });
    const compressed = await wire(route, {
      ...headers,
      "accept-encoding": "br",
    });
    assert.equal(raw.status, 200);
    assert.equal(compressed.status, 200);
    assert.equal(compressed.headers["content-encoding"], "br");
    assert.deepEqual(
      raw.body,
      await readArtifact(rendered, files[representation]),
    );
    assert.deepEqual(
      compressed.body,
      await readArtifact(rendered, `${files[representation]}.br`),
    );
    assert.deepEqual(brotliDecompressSync(compressed.body), raw.body);
    // Wrangler normalizes Accept-Encoding on the upstream request and may
    // decode its response for identity clients. Unit tests separately cover
    // the asset reader's representation selection and distinct validators.
    const unchanged = await wire(route, {
      ...headers,
      "accept-encoding": "br",
      "if-none-match": compressed.headers.etag!,
    });
    assert.equal(unchanged.status, 304);
    assert.equal(unchanged.body.length, 0);
    const head = await wire(
      route,
      { ...headers, "accept-encoding": "br" },
      "HEAD",
    );
    assert.equal(head.status, 200);
    assert.equal(head.body.length, 0);
  }
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
