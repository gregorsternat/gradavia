import { describe, expect, it } from "vitest";
import { gateway } from "./gateway";
import assets from "./asset-service";
import { selectAtlas } from "./publication";
import { pageIdentity } from "./identity";
import { handle } from "./handler";
import {
  checkEvidence,
  type Evidence,
} from "../../../scripts/cloudflare-publication";
import type { Release } from "../../../scripts/prepare-cloudflare-publication";
import { createHash } from "node:crypto";
import { mkdtemp, writeFile, mkdir, symlink, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  validatePublication,
  addArtifact,
  digest,
  partitionPublication,
  type Manifest,
} from "../../../scripts/publication-assets";

const service = (value: string, status = 200) => ({
  fetch: async () => new Response(value, { status }),
});
describe("publication boundaries", () => {
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
    expect(head.headers.get("vary")).toBe("RSC");
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
  });
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
