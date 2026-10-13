import { readFile } from "node:fs/promises";
import path from "node:path";
import { expect, test } from "./fixtures";

test("map code and Leaflet load while the first data response is pending", async ({
  page,
}) => {
  await page.goto("/formations");
  const mapTab = page.getByRole("tab", { name: "Carte", exact: true });
  await expect(mapTab).toHaveAttribute("tabindex", "-1");
  await page.waitForLoadState("networkidle");
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let leafletLoaded = false;
  page.on("response", async (response) => {
    if (response.request().resourceType() === "script") {
      const body = await response.text().catch(() => "");
      if (body.includes("leaflet-container")) leafletLoaded = true;
    }
  });
  await page.route("**/api/workspace/carte?*", async (route) => {
    const response = await route.fetch();
    await gate;
    await route.fulfill({ response });
  });
  try {
    await mapTab.click();
    await expect(
      page.getByText("Chargement de carte…", { exact: true }),
    ).toBeVisible();
    await expect.poll(() => leafletLoaded).toBe(true);
    await expect(page.locator(".leaflet-container")).toHaveCount(0);
  } finally {
    release();
  }
  await expect(page.locator(".leaflet-container")).toBeVisible();
  await page.goBack();
  await expect(
    page.getByRole("tab", { name: "Liste", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await page.goForward();
  await expect(page.locator(".leaflet-container")).toBeVisible();
});

test("formation insights start code and data on activation, retry and survive tab changes", async ({
  page,
  request,
}) => {
  const list = await (await request.get("/api/workspace/formations")).json();
  const id = list.result.data.formations[0].id as string;
  const startedAt = Date.now();
  const requests: string[] = [];
  page.on("request", (request) => {
    if (request.url().endsWith("/insights")) requests.push(request.url());
  });
  await page.goto(`/formations/${encodeURIComponent(id)}`);
  const insights = page.getByRole("tab", { name: "Profils et alternatives" });
  await expect(insights).toHaveAttribute("tabindex", "-1");
  await page.waitForLoadState("networkidle");
  expect(requests).toHaveLength(0);
  if (process.env.E2E_API_DELAY_MS) {
    const artifacts = process.env.ARTIFACTS_DIR ?? ".artifacts";
    const runtime =
      process.env.E2E_PRODUCTION === "1" ? "production" : "development";
    const log = await readFile(
      path.join(artifacts, `browser-${runtime}`, "api-requests.jsonl"),
      "utf8",
    );
    const reads = log
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line) as { time: number; path: string });
    expect(
      reads.filter(
        (read) => read.time >= startedAt && read.path.startsWith("/v1/atlas"),
      ),
    ).toEqual([]);
  }
  let codeLoaded = false;
  page.on("response", async (response) => {
    if (response.request().resourceType() === "script") {
      const body = await response.text().catch(() => "");
      if (body.includes("Mentions au baccalauréat")) codeLoaded = true;
    }
  });
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/formations/*/insights", async (route) => {
    await gate;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: "invalid json",
    });
  });
  try {
    await insights.focus();
    await page.keyboard.press("Enter");
    await expect(
      page.getByRole("status", {
        name: "Chargement des profils et alternatives…",
        exact: true,
      }),
    ).toBeVisible();
    await expect.poll(() => codeLoaded).toBe(true);
  } finally {
    release();
  }
  await expect(page.locator("main").getByRole("alert")).toContainText(
    "temporairement indisponibles",
  );
  await page.unroute("**/api/formations/*/insights");
  await page.getByRole("button", { name: "Réessayer", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: "Mentions au baccalauréat",
      exact: true,
    }),
  ).toBeVisible();
  expect(requests).toHaveLength(2);
  await page.getByRole("tab", { name: "Vue d’ensemble", exact: true }).click();
  await insights.click();
  await expect(
    page.getByRole("heading", {
      name: "Mentions au baccalauréat",
      exact: true,
    }),
  ).toBeVisible();
  expect(requests).toHaveLength(2);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

for (const route of ["/formations", "/observatoire"]) {
  test(`streams the ${route} shell before slow server data`, async ({
    baseURL,
  }) => {
    test.skip(
      !process.env.E2E_API_DELAY_MS,
      "Run with E2E_API_DELAY_MS=1200 to exercise slow upstream reads.",
    );
    const response = await fetch(`${baseURL}${route}`, {
      headers: { "User-Agent": "Mozilla/5.0 Chrome/140.0.0.0 Safari/537.36" },
    });
    expect(response.status).toBe(200);
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let html = "";
    let shellAt = 0;
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      html += decoder.decode(chunk.value, { stream: true });
      if (!shellAt && html.includes('aria-busy="true"')) shellAt = Date.now();
    }
    expect(shellAt).toBeGreaterThan(0);
    expect(Date.now() - shellAt).toBeGreaterThan(500);
    expect(html).toContain("2025");
  });
}

test("detail and insights routes keep real 404s and compact versioned results", async ({
  request,
}) => {
  for (const id of [
    "not-a-formation",
    "11111111-1111-4111-8111-111111111111:999999",
  ]) {
    expect(
      (await request.get(`/formations/${encodeURIComponent(id)}`)).status(),
    ).toBe(404);
    expect(
      (
        await request.get(`/api/formations/${encodeURIComponent(id)}/insights`)
      ).status(),
    ).toBe(404);
  }
  const list = await (await request.get("/api/workspace/formations")).json();
  const id = list.result.data.formations[0].id as string;
  const response = await request.get(
    `/api/formations/${encodeURIComponent(id)}/insights`,
  );
  expect(response.status()).toBe(200);
  expect(response.headers()["cache-control"]).toBe("private, no-store");
  const result = await response.json();
  expect(Object.keys(result.data).sort()).toEqual(["detail", "peers"]);
  expect(result.data.detail.item.id).toBe(id);
  expect(result.data.peers.alternatives.length).toBeLessThanOrEqual(6);
  expect(
    result.data.peers.alternatives.every((peer: { id: string }) =>
      peer.id.startsWith(`${result.data.detail.source.releaseId}:`),
    ),
  ).toBe(true);
});
