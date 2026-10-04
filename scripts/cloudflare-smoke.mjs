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
      await writeFile(
        `${directory}/result.json`,
        JSON.stringify(
          {
            status: "passed",
            origin,
            commit: process.env.GITHUB_SHA ?? null,
            attempt,
            formations: count,
            checkedAt: new Date().toISOString(),
          },
          null,
          2,
        ) + "\n",
      );
      console.log(
        `Production smoke passed: ${count} formations and detail verified.`,
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
