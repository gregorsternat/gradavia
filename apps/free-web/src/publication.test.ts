import { describe, expect, it } from "vitest";
import { gateway } from "./gateway";
import assets from "./asset-service";
import { selectAtlas } from "./publication";
import { pageAsset, pageIdentity } from "./identity";
import { handle } from "./handler";
import {
  checkEvidence,
  type Evidence,
} from "../../../scripts/cloudflare-publication";
import type { Release } from "../../../scripts/prepare-cloudflare-publication";
import { createHash } from "node:crypto";
import {
  mkdtemp,
  writeFile,
  mkdir,
  symlink,
  readFile,
  rm,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { brotliDecompressSync } from "node:zlib";
import { join } from "node:path";
import {
  validatePublication,
  addArtifact,
  addDocumentArtifact,
  digest,
  partitionPublication,
  BYTE_LIMIT,
  type Manifest,
} from "../../../scripts/publication-assets";
import { packPublication } from "../../../scripts/pack-publication";

const service = (value: string, status = 200) => ({
  fetch: async () => new Response(value, { status }),
});
describe("publication boundaries", () => {
  it.each([false, true])(
    "packs a page index with split=%s without changing its publication identity",
    async (split) => {
      const root = await mkdtemp(join(tmpdir(), "gradavia-page-index-"));
      const source = join(root, "source");
      const output = join(root, "packed");
      const manifest: Manifest = { format: 1, files: {} };
      const publicationId = "a".repeat(20);
      try {
        for (const [name, value] of Object.entries({
          "publication.json": "{}",
          "runtime/api/index.js": "export default {};",
          "runtime/web/index.js": "export default {};",
          "pages.json":
            (split ? " ".repeat(BYTE_LIMIT) : "") +
            JSON.stringify({ format: 1, publicationId, routes: {} }),
        }))
          await addArtifact(source, manifest, name, value);
        await writeFile(
          join(source, "manifest.json"),
          JSON.stringify(manifest),
        );
        await packPublication(source, output);
        const release = JSON.parse(
          await readFile(join(output, "release.json"), "utf8"),
        );
        expect(release.dataId).toBe(publicationId);
        expect(release.logicalFiles).toBe(Object.keys(manifest.files).length);
        const archive = join(output, "archive");
        await validatePublication(archive);
        for (const name of Object.keys(manifest.files).filter((name) =>
          name.startsWith("pages.json"),
        )) {
          const key = digest(name);
          const lookup = JSON.parse(
            await readFile(
              join(archive, `lookup/${key.slice(0, 3)}.json`),
              "utf8",
            ),
          )[key];
          const pack = await readFile(join(archive, lookup.pack));
          expect(
            digest(pack.subarray(lookup.offset, lookup.offset + lookup.bytes)),
          ).toBe(manifest.files[name]!.sha256);
        }
      } finally {
        await rm(root, { recursive: true });
      }
    },
  );
  it("keeps identity bytes and prepares smaller lossless representations for large documents", async () => {
    const root = await mkdtemp(join(tmpdir(), "gradavia-brotli-"));
    const manifest: Manifest = { format: 1, files: {} };
    const content = "<p>Données publiques françaises</p>".repeat(6000);
    await addDocumentArtifact(root, manifest, "large.html", content);
    await addDocumentArtifact(root, manifest, "small.rsc", "small document");
    expect(await readFile(join(root, "large.html"), "utf8")).toBe(content);
    const compressed = await readFile(join(root, "large.html.br"));
    expect(brotliDecompressSync(compressed).toString()).toBe(content);
    expect(compressed.length).toBeLessThan(Buffer.byteLength(content));
    expect(manifest.files["small.rsc.br"]).toBeUndefined();
  });
  it("negotiates encoded page bytes and representation-specific validators through the gateway", async () => {
    const key = digest(await pageAsset("/formations", false));
    const identity = {
      pack: "raw.bin",
      offset: 0,
      bytes: 8,
      packBytes: 8,
      sha256: "raw",
    };
    const encoded = {
      pack: "br.bin",
      offset: 0,
      bytes: 7,
      packBytes: 7,
      sha256: "br",
    };
    const publication = {
      fetch: (request: Request) =>
        assets.fetch(request, {
          SHARDS: JSON.stringify([{ binding: "FILES", first: "", last: "zz" }]),
          FILES: {
            fetch: async (request: Request) => {
              const path = new URL(request.url).pathname;
              if (path.startsWith("/lookup/"))
                return Response.json({ [key]: { ...identity, br: encoded } });
              return new Response(
                path.endsWith("br.bin") ? "encoded" : "identity",
              );
            },
          },
        }),
    };
    const get = (headers: Record<string, string>, method = "GET") =>
      gateway(
        new Request("https://gradavia.com/formations", { headers, method }),
        {
          CURRENT_ID: "release",
          CURRENT: {
            fetch: (request) =>
              handle(request, {
                PUBLICATION: publication,
                GRADAVIA_API: service("unused"),
              }),
          },
        },
      );
    for (const [accept, compressed] of [
      ["br", true],
      ["gzip, br;q=0.5", true],
      ["*", true],
      ["br;q=0, *;q=1", false],
      ["br;q=invalid", false],
      ["gzip", false],
      ["", false],
    ] as const) {
      const response = await get({ "accept-encoding": accept });
      expect(await response.text()).toBe(compressed ? "encoded" : "identity");
      expect(response.headers.get("content-encoding")).toBe(
        compressed ? "br" : null,
      );
      expect(response.headers.get("etag")).toBe(compressed ? '"br"' : '"raw"');
      expect(response.headers.get("vary")).toBe("RSC, Accept-Encoding");
    }
    const same = await get({
      "accept-encoding": "br",
      "if-none-match": '"br"',
    });
    expect(same.status).toBe(304);
    expect(await same.text()).toBe("");
    expect(
      (await get({ "accept-encoding": "identity", "if-none-match": '"br"' }))
        .status,
    ).toBe(200);
    expect(await (await get({ "accept-encoding": "br" }, "HEAD")).text()).toBe(
      "",
    );
  });
  it("caches immutable chunks and revalidates pages without sending a body for HEAD or 304", async () => {
    const env = {
      PUBLICATION: {
        fetch: async () => new Response("bytes", { headers: { etag: '"v1"' } }),
      },
      GRADAVIA_API: service("unused"),
    };
    const get = (path: string, init?: RequestInit) =>
      handle(new Request(`https://gradavia.com${path}`, init), env);
    const font = await get("/_next/static/media/font.woff2");
    expect(font.headers.get("content-type")).toBe("font/woff2");
    expect(font.headers.get("cache-control")).toContain("immutable");
    const head = await get("/formations", { method: "HEAD" });
    expect(head.status).toBe(200);
    expect(await head.text()).toBe("");
    expect(head.headers.get("vary")).toBe("RSC, Accept-Encoding");
    const same = await get("/formations", {
      headers: { "if-none-match": 'W/"v1"' },
    });
    expect(same.status).toBe(304);
    expect(await same.text()).toBe("");
    expect(
      (await get("/formations", { headers: { "if-none-match": '"v0"' } }))
        .status,
    ).toBe(200);
  });
  it("rejects unmeasured, stale, mismatched or over-budget activation evidence", () => {
    const now = Date.now();
    const release = { id: "candidate", shards: [{}] } as Release;
    const evidence: Evidence = {
      releaseId: release.id,
      measuredAt: new Date(now).toISOString(),
      cloudflare: {
        coldSamples: 100,
        warmSamples: 100,
        cpuP99Ms: 7,
        maxMemoryMiB: 100,
        resourceLimitErrors: 0,
        requestsLast24Hours: 50_000,
        workersOnAccount: 5,
      },
      browser: {
        desktop: true,
        mobile: true,
        noJavaScript: true,
        lcpMs: 2400,
        cls: 0.05,
        interactionP95Ms: 180,
        slowJourneyP95BeforeMs: 6000,
        slowJourneyP95AfterMs: 2900,
      },
    };
    expect(() => checkEvidence(release, evidence, now)).not.toThrow();
    expect(() =>
      checkEvidence(release, { ...evidence, releaseId: "different" }, now),
    ).toThrow("another");
    expect(() => checkEvidence(release, evidence, now + 25 * 3600_000)).toThrow(
      "stale",
    );
    for (const [key, value] of Object.entries({
      coldSamples: 99,
      warmSamples: 99,
      cpuP99Ms: 8,
      maxMemoryMiB: 128,
      resourceLimitErrors: 1,
      requestsLast24Hours: 80_000,
      workersOnAccount: 90,
    }))
      expect(() =>
        checkEvidence(
          release,
          { ...evidence, cloudflare: { ...evidence.cloudflare, [key]: value } },
          now,
        ),
      ).toThrow("safety margin");
    expect(() =>
      checkEvidence(
        release,
        { ...evidence, cloudflare: { ...evidence.cloudflare, cpuP99Ms: NaN } },
        now,
      ),
    ).toThrow("Missing measurement");
    expect(() =>
      checkEvidence(
        release,
        { ...evidence, browser: { ...evidence.browser, mobile: false } },
        now,
      ),
    ).toThrow("parity");
  });
  it("pins open tabs to the previous reader and fails closed when their version expired", async () => {
    const env = {
      CURRENT: service("new"),
      CURRENT_ID: "new",
      PREVIOUS: service("old"),
      PREVIOUS_ID: "old",
    };
    const get = (id?: string) =>
      gateway(
        new Request("https://gradavia.com/api/workspace/formations", {
          headers: id ? { "x-gradavia-publication": id } : {},
        }),
        env,
      );
    expect(await (await get()).text()).toBe("new");
    expect(await (await get("old")).text()).toBe("old");
    expect((await get("expired")).status).toBe(409);
  });
  it("recovers old Next chunks only for static requests", async () => {
    const env = {
      CURRENT: service("missing", 404),
      CURRENT_ID: "new",
      PREVIOUS: service("old chunk"),
      PREVIOUS_ID: "old",
    };
    expect(
      await (
        await gateway(
          new Request("https://gradavia.com/_next/static/old.js"),
          env,
        )
      ).text(),
    ).toBe("old chunk");
    expect(
      (
        await gateway(
          new Request("https://gradavia.com/formations/missing"),
          env,
        )
      ).status,
    ).toBe(404);
  });
  it("selects an explicit historical publication without substituting the current one", () => {
    const old = "11111111-1111-1111-1111-111111111111",
      current = "22222222-2222-2222-2222-222222222222";
    const publication = {
      format: 1 as const,
      pointers: [{ dataset: "year", release: current }],
      atlases: [old, current].map((releaseId) => ({
        family: "parcoursup",
        releaseId,
        campaign: 2025,
        datasetId: "year",
      })),
    };
    expect(selectAtlas(publication, new URLSearchParams())?.valueOf()).toEqual(
      publication.atlases[1],
    );
    expect(
      selectAtlas(publication, new URLSearchParams({ version: old })),
    ).toEqual(publication.atlases[0]);
    expect(
      selectAtlas(publication, new URLSearchParams({ campagne: "2018" })),
    ).toBeUndefined();
    expect(
      selectAtlas(publication, new URLSearchParams({ version: "invalid" })),
    ).toBe("invalid");
  });
  it("removes transport and tracking noise without merging actual page states", () => {
    const id = "12345678-1234-1234-1234-123456789abc:42";
    expect(pageIdentity(`/formations/${id}`)).toBe(
      pageIdentity(`/formations/${encodeURIComponent(id).toUpperCase()}`),
    );
    expect(
      pageIdentity("/formations?utm_source=test&page=2&_rsc=xyz&vue=cartes"),
    ).toBe("/formations?page=2&vue=cartes");
    expect(pageIdentity("/comparer?ids=")).not.toBe(pageIdentity("/comparer"));
    expect(pageIdentity("/atlas?famille=apb")).not.toBe(
      pageIdentity("/atlas?famille=apprentissage"),
    );
    for (const route of ["atlas", "formations"])
      expect(
        pageIdentity(`/${route}/${id}?famille=apb&campagne=2017&q=test`),
      ).toBe(pageIdentity(`/${route}/${id}`));
  });
  it.each([
    ["apprentissage", false],
    ["apprentissage", true],
    ["apb", false],
    ["apb", true],
  ] as const)(
    "serves published %s detail links with ignored query parameters (RSC: %s)",
    async (family, rsc) => {
      const path = "/atlas/12345678-1234-1234-1234-123456789abc%3A42";
      const published = await pageAsset(path, rsc);
      const env = {
        PUBLICATION: {
          fetch: async (request: Request) =>
            new URL(request.url).pathname === `/${published}`
              ? new Response("published detail")
              : new Response("missing", { status: 404 }),
        },
        GRADAVIA_API: service("unused"),
      };
      const get = (detailPath: string) =>
        handle(
          new Request(
            `https://gradavia.com${detailPath}?famille=${family}&_rsc=transport`,
            { headers: rsc ? { rsc: "1" } : {} },
          ),
          env,
        );
      const response = await get(path);
      expect(response.status).toBe(200);
      expect(await response.text()).toBe("published detail");
      expect(response.headers.get("content-type")).toContain(
        rsc ? "text/x-component" : "text/html",
      );
      expect((await get(path.replace("%3A42", "%3A43"))).status).toBe(404);
    },
  );
  it("extracts a bounded object when asset bindings ignore Range, including chunk boundaries", async () => {
    const key = createHash("sha256").update("pages/test.html").digest("hex");
    let cancelled = false;
    const env = {
      SHARDS: JSON.stringify([{ binding: "S", first: "lookup/", last: "zz" }]),
      S: {
        fetch: async (request: Request) => {
          if (request.url.includes("lookup/"))
            return Response.json({
              [key]: {
                pack: "packs/0.bin",
                offset: 3,
                bytes: 5,
                sha256: "digest",
                packBytes: 12,
              },
            });
          const chunks = [
            new TextEncoder().encode("012ab"),
            new TextEncoder().encode("cde9"),
            new TextEncoder().encode("end"),
          ];
          return new Response(
            new ReadableStream<Uint8Array>({
              pull(c) {
                if (chunks.length) c.enqueue(chunks.shift()!);
                else c.close();
              },
              cancel() {
                cancelled = true;
              },
            }),
            { headers: { "content-length": "12" } },
          );
        },
      },
    };
    const response = await assets.fetch(
      new Request("https://publication.internal/pages/test.html"),
      env,
    );
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("abcde");
    expect(cancelled).toBe(true);
    expect(
      (
        await assets.fetch(
          new Request("https://publication.internal/absent"),
          env,
        )
      ).status,
    ).toBe(404);
  });
  it("rejects missing, changed, oversized and symlink publication artifacts", async () => {
    const root = await mkdtemp(join(tmpdir(), "gradavia-publication-"));
    const manifest: Manifest = { format: 1, files: {} };
    await addArtifact(root, manifest, "publication.json", "{}");
    await writeFile(join(root, "manifest.json"), JSON.stringify(manifest));
    await expect(validatePublication(root)).resolves.toEqual(manifest);
    await writeFile(join(root, "publication.json"), "[]");
    await expect(validatePublication(root)).rejects.toThrow("checksum");
    await mkdir(join(root, "outside"));
    await writeFile(join(root, "outside", "secret"), "data");
    await symlink(join(root, "outside"), join(root, "link"));
    manifest.files["link/secret"] = { bytes: 4, sha256: digest("data") };
    await writeFile(join(root, "publication.json"), "{}");
    await writeFile(join(root, "manifest.json"), JSON.stringify(manifest));
    await expect(validatePublication(root)).rejects.toThrow("symlink");
  });
  it("reserves the previous publication and never overwrites staging", async () => {
    const root = await mkdtemp(join(tmpdir(), "gradavia-partition-"));
    const manifest: Manifest = { format: 1, files: {} };
    await addArtifact(root, manifest, "publication.json", "{}");
    await writeFile(join(root, "manifest.json"), JSON.stringify(manifest));
    const output = join(root, "staging");
    await expect(partitionPublication(root, output, 8)).rejects.toThrow(
      "budget",
    );
    await partitionPublication(root, output, 9);
    await expect(partitionPublication(root, output, 9)).rejects.toThrow();
    expect(
      await readFile(join(output, "assets-0", "publication.json"), "utf8"),
    ).toBe("{}");
  });
});
