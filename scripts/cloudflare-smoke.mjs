import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import { chromium, expect } from "@playwright/test";

const origin = "https://gradavia.com";
const directory = ".artifacts/cloudflare/smoke";
const attempts = 6;
const proxyUrl = process.env.HTTPS_PROXY ?? process.env.HTTP_PROXY;
const proxy = proxyUrl ? new URL(proxyUrl) : undefined;

await mkdir(directory, { recursive: true });
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  reducedMotion: "reduce",
  proxy: proxy
    ? {
        server: `${proxy.protocol}//${proxy.host}`,
        username: decodeURIComponent(proxy.username),
        password: decodeURIComponent(proxy.password),
      }
    : undefined,
});
const page = await context.newPage();
page.setDefaultTimeout(20_000);
page.setDefaultNavigationTimeout(35_000);
let stage = "health";

try {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      stage = "health";
      const health = await context.request.get(`${origin}/api/health`, {
        timeout: 30_000,
        maxRedirects: 0,
      });
      assert.equal(health.status(), 200);
      assert.deepEqual(await health.json(), { status: "ok" });

      stage = "canonical redirect";
      const canonical = await context.request.get(
        "https://www.gradavia.com/formations?q=arts%26design&vue=cartes",
        { timeout: 30_000, maxRedirects: 0 },
      );
      assert.equal(canonical.status(), 308);
      assert.equal(
        canonical.headers().location,
        `${origin}/formations?q=arts%26design&vue=cartes`,
      );

      stage = "production gallery exclusion";
      const gallery = await context.request.get(`${origin}/dev/ui`, {
        timeout: 30_000,
        maxRedirects: 0,
      });
      assert.equal(gallery.status(), 404);

      // Liveness also succeeds when the private API or its database is down.
      // Require actual rendered results and a retained formation's provenance.
      stage = "published formation results";
      const response = await page.goto(`${origin}/formations?vue=cartes`);
      assert.equal(response?.status(), 200);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(
        "Explorer les formations",
      );
      const status = page.getByRole("status");
      await expect(status).toContainText(/\d[\d\s]* résultats?/);
      const count = Number(
        (await status.innerText()).split("résultat")[0].replace(/\s/g, ""),
      );
      assert.ok(Number.isSafeInteger(count) && count > 0);
      const first = page.getByRole("article").first();
      await expect(first).toBeVisible();
      const title = await first.getByRole("heading").innerText();
      await first.getByRole("link", { name: "Voir la formation" }).click();

      stage = "formation detail and provenance";
      await expect(page).toHaveURL(/\/formations\/[^/?]+/);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
      await expect(
        page.getByRole("heading", { name: "Places proposées", exact: true }),
      ).toBeVisible();
      await page.getByRole("tab", { name: "Définitions et source" }).click();
      await expect(
        page.getByRole("button", { name: /^Source et périmètre · Parcoursup/ }),
      ).toBeVisible();

      // Exercise the complete snapshot through the public Worker, not just the
      // small metadata or paginated formation responses. No production count
      // is hard-coded: publication can legitimately change between deploys.
      stage = "public dataset metadata";
      const metadataResponse = await context.request.get(
        `${origin}/api/v1/datasets?famille=parcoursup&format=metadata`,
        { timeout: 35_000 },
      );
      assert.equal(metadataResponse.status(), 200);
      const metadata = await metadataResponse.json();
      assert.equal(metadata.schemaVersion, 1);
      assert.equal(metadata.family, "parcoursup");
      assert.ok(Number.isSafeInteger(metadata.records) && metadata.records > 0);
      assert.ok(metadata.records <= 30_000);
      assert.match(metadata.source.releaseId, /^[0-9a-f-]{36}$/);
      assert.ok(Number.isSafeInteger(metadata.source.campaign));
      assert.ok(
        Array.isArray(metadata.coverage) && metadata.coverage.length > 0,
      );
      const snapshotUrl = new URL(metadata.snapshot, origin);
      assert.equal(snapshotUrl.origin, origin);
      assert.equal(snapshotUrl.pathname, "/api/v1/datasets");
      assert.equal(
        snapshotUrl.searchParams.get("version"),
        metadata.source.releaseId,
      );

      stage = "complete public dataset snapshot";
      const snapshotResponse = await context.request.get(snapshotUrl.href, {
        timeout: 35_000,
      });
      assert.equal(snapshotResponse.status(), 200);
      assert.match(snapshotResponse.headers()["cache-control"], /immutable/);
      const snapshotBytes = await snapshotResponse.body();
      assert.ok(
        snapshotBytes.length > 0 && snapshotBytes.length <= 32 * 1024 * 1024,
      );
      const snapshot = JSON.parse(snapshotBytes.toString("utf8"));
      assert.equal(snapshot.status, "ready");
      assert.equal(snapshot.data.family, metadata.family);
      assert.equal(snapshot.data.source.releaseId, metadata.source.releaseId);
      assert.equal(snapshot.data.source.campaign, metadata.source.campaign);
      assert.equal(snapshot.data.items.length, metadata.records);
      assert.deepEqual(snapshot.data.coverage, metadata.coverage);
      assert.equal(
        new Set(snapshot.data.items.map((row) => row.id)).size,
        metadata.records,
      );
      for (const coverage of metadata.coverage) {
        const actual = { observed: 0, missing: 0, suppressed: 0, invalid: 0 };
        for (const row of snapshot.data.items) {
          assert.ok(row.id.startsWith(`${metadata.source.releaseId}:`));
          const state = row.states[coverage.key] ?? "observed";
          assert.ok(Object.hasOwn(actual, state));
          if (state === "observed") {
            assert.ok(Number.isFinite(row.metrics[coverage.key]));
            assert.ok(row.metrics[coverage.key] >= 0);
          } else {
            assert.equal(row.metrics[coverage.key], null);
          }
          actual[state] += 1;
        }
        for (const state of Object.keys(actual))
          assert.equal(actual[state], coverage[state]);
      }

      stage = "full analysis rendering and hydration";
      const analysisQuery = new URLSearchParams({
        famille: metadata.family,
        campagne: String(metadata.source.campaign),
        version: metadata.source.releaseId,
      });
      const analysisResponse = await page.goto(
        `${origin}/analyses?${analysisQuery}`,
      );
      assert.equal(analysisResponse?.status(), 200);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(
        "Atelier d’analyse",
      );
      const renderedCount = page
        .getByText(/^\d[\d\s]* formations sur \d[\d\s]* · \d{4}$/)
        .filter({ visible: true });
      await expect(renderedCount).toBeVisible();
      assert.equal(
        (await renderedCount.innerText()).replace(/\s/g, ""),
        `${metadata.records}formationssur${metadata.records}·${metadata.source.campaign}`,
      );
      await page.getByRole("tab", { name: "Qualité", exact: true }).click();
      await expect(
        page.getByRole("tab", { name: "Qualité", exact: true }),
      ).toHaveAttribute("aria-selected", "true");
      await writeFile(
        `${directory}/result.json`,
        JSON.stringify(
          {
            status: "passed",
            origin,
            commit: process.env.GITHUB_SHA ?? null,
            attempt,
            formations: count,
            snapshotRecords: metadata.records,
            snapshotBytes: snapshotBytes.length,
            snapshotRelease: metadata.source.releaseId,
            checkedAt: new Date().toISOString(),
          },
          null,
          2,
        ) + "\n",
      );
      console.log(
        `Production smoke passed: ${count} formations, detail and ${metadata.records}-record analysis verified.`,
      );
      break;
    } catch {
      // Allow bounded propagation/cold-start retries without hiding a persistent
      // data outage behind the independent /api/health liveness endpoint.
      console.error(
        `Production smoke attempt ${attempt}/${attempts} failed at ${stage}.`,
      );
      if (attempt < attempts) {
        await delay(15_000);
        continue;
      }
      await page
        .screenshot({ path: `${directory}/failure.png`, fullPage: true })
        .catch(() => {});
      await writeFile(
        `${directory}/result.json`,
        JSON.stringify({ status: "failed", stage, attempts }, null, 2) + "\n",
      );
      process.exitCode = 1;
    }
  }
} finally {
  await browser.close();
}
