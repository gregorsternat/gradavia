import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";

async function openWorkspace(page: Page, path: string) {
  await page.goto(path);
  if (new URL(page.url()).pathname === "/favoris") {
    await expect(
      page.getByRole("button", { name: "Liste de formations" }),
    ).toBeEnabled();
    return;
  }
  // Wait for roving keyboard focus before exercising client-side navigation.
  await expect(
    page
      .getByRole("tablist")
      .first()
      .getByRole("tab", { selected: false })
      .first(),
  ).toHaveAttribute("tabindex", "-1");
}

test("retired tools redirect to useful destinations and cannot load as panels", async ({
  page,
  request,
}, testInfo) => {
  for (const [legacy, destination] of [
    ["/budget", "/favoris"],
    ["/favoris?onglet=budget", "/favoris"],
    ["/decouvrir?campagne=2024", "/observatoire?campagne=2024"],
    [
      "/observatoire?campagne=2024&onglet=decouvrir",
      "/observatoire?campagne=2024",
    ],
  ]) {
    const response = await request.get(legacy!, { maxRedirects: 0 });
    expect(response.status()).toBe(308);
    const target = new URL(
      response.headers().location!,
      "https://example.test",
    );
    expect(target.pathname + target.search).toBe(destination);
  }
  for (const panel of ["budget", "decouvrir"])
    expect((await request.get(`/api/workspace/${panel}`)).status()).toBe(404);
  await openWorkspace(page, "/favoris?onglet=budget");
  await expect(page).toHaveURL(/\/favoris$/);
  await expect(
    page.getByRole("tab", { name: "Budget", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Mes favoris", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("favorites-simplified.png"),
    fullPage: true,
  });
  await openWorkspace(page, "/observatoire?onglet=decouvrir");
  const tabs = page.getByRole("tablist", {
    name: "Dans Observatoire",
    exact: true,
  });
  await expect(tabs.getByRole("tab")).toHaveText([
    "Vue d’ensemble",
    "Territoires",
    "Évolutions",
    "Atelier d’analyse",
  ]);
  await tabs.getByRole("tab", { name: "Vue d’ensemble", exact: true }).focus();
  await page.keyboard.press("End");
  await expect(
    tabs.getByRole("tab", { name: "Atelier d’analyse", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("heading", { name: "Atelier d’analyse", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Control+k");
  const search = page
    .getByRole("dialog", { name: "Recherche rapide" })
    .getByRole("combobox");
  for (const term of ["Budget", "À vous d’estimer"]) {
    await search.fill(term);
    await expect(
      page
        .getByRole("dialog", { name: "Recherche rapide" })
        .getByRole("option"),
    ).toHaveCount(0);
  }
  await page.keyboard.press("Escape");
  await page.screenshot({
    path: testInfo.outputPath("research-tools-retained.png"),
    fullPage: true,
  });
});

test("comparison tabs preserve drafts, use native history and avoid repeated reads @smoke", async ({
  page,
}) => {
  await openWorkspace(page, "/comparer");
  const requests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/workspace/")) requests.push(request.url());
  });
  await page.getByRole("tab", { name: "Modalités", exact: true }).click();
  await expect(page).toHaveURL(/\/comparer\?onglet=modalites$/);
  await expect(
    page.getByRole("heading", { name: "Comparer les modalités" }).first(),
  ).toBeVisible();
  const field = page.getByRole("textbox", {
    name: "Rechercher une formation hors apprentissage",
    exact: true,
  });
  await field.fill("Recherche conservée");
  const count = requests.length;
  await page.getByRole("tab", { name: "Ma sélection", exact: true }).click();
  await page.getByRole("tab", { name: "Modalités", exact: true }).click();
  await expect(field).toHaveValue("Recherche conservée");
  expect(requests.length).toBe(count);
  await page.goBack();
  await expect(
    page.getByRole("tab", { name: "Ma sélection", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await page.goForward();
  await expect(field).toHaveValue("Recherche conservée");
  expect(await page.locator("main#contenu").count()).toBe(1);
});

test("keyboard focus does not load an unactivated tab", async ({ page }) => {
  await openWorkspace(page, "/comparer");
  await expect(
    page.getByRole("tab", { name: "Ma sélection", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  const tab = page.getByRole("tab", { name: "Ma sélection", exact: true });
  await expect(tab).not.toHaveAttribute("aria-disabled", "true");
  await tab.focus();
  await page.keyboard.press("ArrowRight");
  await expect(
    page.getByRole("tab", { name: "Modalités", exact: true }),
  ).toBeFocused();
  await expect(tab).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/onglet=modalites/);
});

test("legacy tools redirect to their rendered, shareable panel", async ({
  page,
  request,
}) => {
  const response = await request.get("/modalites", { maxRedirects: 0 });
  expect(response.status()).toBe(308);
  expect(response.headers().location).toBe("/comparer?onglet=modalites");
  await openWorkspace(page, "/modalites");
  await expect(
    page.getByRole("tab", { name: "Modalités", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await page.reload();
  await expect(
    page.getByRole("tab", { name: "Modalités", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
});

test("a failed first panel load leaves other tabs usable and can be retried @smoke", async ({
  page,
}) => {
  await openWorkspace(page, "/comparer");
  await expect(
    page.getByRole("tab", { name: "Ma sélection", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await page.route("**/api/workspace/modalites*", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: "invalid json",
    }),
  );
  await page.getByRole("tab", { name: "Modalités", exact: true }).click();
  await expect(page.locator("main").getByRole("alert")).toContainText(
    "temporairement indisponibles",
  );
  await page.getByRole("tab", { name: "Ma sélection", exact: true }).click();
  await expect(
    page.getByRole("tab", { name: "Ma sélection", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await page.unroute("**/api/workspace/modalites*");
  await page.getByRole("tab", { name: "Modalités", exact: true }).click();
  await page.getByRole("button", { name: "Réessayer", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Comparer les modalités" }).first(),
  ).toBeVisible();
});

for (const [path, tabs] of [
  ["/specialites", ["Depuis mes spécialités", "Depuis une formation"]],
  ["/comparer?ids=", ["Ma sélection", "Modalités"]],
  [
    "/observatoire",
    ["Vue d’ensemble", "Territoires", "Évolutions", "Atelier d’analyse"],
  ],
  ["/sources", ["Sources et définitions", "API et notebooks", "Archives APB"]],
] as const) {
  test(`${path}: every pair of tools keeps its mounted content and cached data`, async ({
    page,
  }) => {
    const reads: string[] = [];
    page.on("request", (request) => {
      if (request.url().includes("/api/workspace/")) reads.push(request.url());
    });
    await openWorkspace(page, path);
    await expect(page.locator("main h1").first()).toBeVisible();
    expect(reads).toEqual([]);
    const activate = async (name: string) => {
      await page.getByRole("tab", { name, exact: true }).click();
      const content = page
        .locator('main > div [role="tabpanel"]:visible')
        .first();
      await expect(content.locator("h1")).toBeVisible();
      await expect(content.locator('[aria-busy="true"]')).toHaveCount(0);
      return content;
    };
    for (const name of tabs) await activate(name);
    const readCount = reads.length;
    // Sources/API and overview/territories reuse the initial server result.
    if (path === "/sources")
      expect(
        reads.filter((url) => /\/(sources|donnees)\?/.test(url)),
      ).toHaveLength(0);
    if (path === "/observatoire")
      expect(
        reads.filter((url) => /\/(overview|territoires)\?/.test(url)),
      ).toHaveLength(0);
    for (const from of tabs) {
      const content = await activate(from);
      const node = await content.locator("h1").elementHandle();
      for (const to of tabs) {
        if (to === from) continue;
        await activate(to);
        await activate(from);
        expect(await node!.evaluate((element) => element.isConnected)).toBe(
          true,
        );
      }
    }
    expect(reads).toHaveLength(readCount);
    expect(await page.locator("main").count()).toBe(1);
    expect(
      await page.locator("[id]").evaluateAll((elements) => {
        const ids = elements.map((element) => element.id);
        return ids.filter((id, index) => ids.indexOf(id) !== index);
      }),
    ).toEqual([]);
    expect(
      await page
        .locator("body")
        .evaluate((element) => element.scrollWidth <= element.clientWidth),
    ).toBe(true);
  });
}

test("historical routes retain their complete queries and fragments", async ({
  request,
  page,
}) => {
  for (const [legacy, path, tab] of [
    ["/modalites", "/comparer", "modalites"],
    ["/territoires", "/observatoire", "territoires"],
    ["/analyses", "/observatoire", "analyses"],
    ["/evolutions", "/observatoire", "evolutions"],
    ["/donnees", "/sources", "donnees"],
    ["/archives", "/sources", "archives"],
    ["/specialites/inverse", "/specialites", "formation"],
    ["/carte", "/formations", "carte"],
    ["/apprentissage", "/formations", "carte"],
  ]) {
    const response = await request.get(
      `${legacy}?ids=&partage=1&page=2&campagne=2025&version=retained`,
      { maxRedirects: 0 },
    );
    expect(response.status()).toBe(308);
    const target = new URL(
      response.headers().location!,
      "https://example.test",
    );
    expect(target.pathname).toBe(path);
    expect(target.searchParams.get("onglet")).toBe(tab);
    expect(target.searchParams.has("ids")).toBe(true);
    for (const [key, value] of [
      ["ids", ""],
      ["partage", "1"],
      ["page", "2"],
      ["campagne", "2025"],
      ["version", "retained"],
    ])
      expect(target.searchParams.get(key!)).toBe(value);
  }
  await openWorkspace(page, "/modalites#selection");
  await expect(page).toHaveURL(/\/comparer\?onglet=modalites#selection$/);
  await openWorkspace(page, "/comparer?onglet=inconnu&ids=");
  await expect(
    page.getByRole("tab", { name: "Ma sélection", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  expect(new URL(page.url()).searchParams.get("ids")).toBe("");
  expect((await request.get("/api/workspace/unknown")).status()).toBe(404);
});

test("server-rendered tabs retain native destinations and tool-specific metadata without JavaScript", async ({
  browser,
  baseURL,
  page,
}) => {
  const context = await browser.newContext({
    baseURL,
    javaScriptEnabled: false,
    viewport: page.viewportSize(),
  });
  try {
    const staticPage = await context.newPage();
    await staticPage.goto("/observatoire");
    await staticPage
      .getByRole("tab", { name: "Territoires", exact: true })
      .click();
    await expect(staticPage.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      "https://gradavia.com/observatoire?onglet=territoires",
    );
    await expect(staticPage.locator('meta[name="robots"]')).toHaveAttribute(
      "content",
      "index, follow",
    );
    await staticPage
      .getByRole("tab", { name: "Atelier d’analyse", exact: true })
      .click();
    await expect(staticPage.locator('meta[name="robots"]')).toHaveAttribute(
      "content",
      "noindex, follow",
    );
    await staticPage.goto("/formations?onglet=carte");
    await expect(staticPage.locator('meta[name="robots"]')).toHaveAttribute(
      "content",
      "index, follow",
    );
    await expect(staticPage.getByRole("heading", { level: 1 })).toContainText(
      "carte",
    );
  } finally {
    await context.close();
  }
});

test("slow obsolete responses cannot overwrite a newer panel context", async ({
  page,
}) => {
  await openWorkspace(page, "/observatoire");
  let release!: () => void;
  const barrier = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(
    "**/api/workspace/overview*campagne=2018*",
    async (route) => {
      const response = await route.fetch();
      await barrier;
      await route.fulfill({ response });
    },
  );
  const campaign = page.getByRole("button", {
    name: "Campagne d’admission",
    exact: true,
  });
  await campaign.click();
  await page.getByRole("option", { name: "2018", exact: true }).click();
  await expect(
    page.locator('[role="tabpanel"]:visible > div[aria-busy]'),
  ).toHaveAttribute("aria-busy", "true");
  await page
    .getByRole("tab", { name: "Atelier d’analyse", exact: true })
    .click();
  await expect(page.locator("main h1:visible")).toBeVisible();
  await page.goBack();
  await page.goBack();
  await expect(page).toHaveURL(/\/observatoire$/);
  const obsolete = page.waitForResponse(
    (response) =>
      response.url().includes("/api/workspace/overview?") &&
      response.url().includes("campagne=2018"),
  );
  release();
  await obsolete;
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  await expect(page.locator("main h1:visible")).toBeVisible();
  await expect(campaign).toContainText("2025");
  await expect(page.locator("main")).toContainText("6 537");
});

test("the default list campaign and sort retain pagination, drafts and scroll across the map", async ({
  page,
}) => {
  await openWorkspace(page, "/formations?page=2");
  const reads: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/workspace/")) reads.push(request.url());
  });
  const draft = page.getByRole("searchbox");
  await draft.fill("Brouillon non soumis");
  await page.evaluate(() => window.scrollTo({ top: 180, behavior: "instant" }));
  const tabs = page.getByRole("tablist", {
    name: "Dans Formations",
    exact: true,
  });
  // Keyboard activation avoids scrolling the trigger into view before switching.
  await tabs.getByRole("tab", { name: "Carte", exact: true }).focus();
  await page.evaluate(() => window.scrollTo({ top: 180, behavior: "instant" }));
  const scroll = await page.evaluate(() => window.scrollY);
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("textbox", { name: "Rechercher dans la carte" }),
  ).toBeVisible();
  await tabs.getByRole("tab", { name: "Liste", exact: true }).click();
  await expect(page).toHaveURL(/page=2/);
  await expect(draft).toHaveValue("Brouillon non soumis");
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(scroll);
  expect(
    reads.filter((url) => url.includes("/api/workspace/formations?")),
  ).toHaveLength(0);
});

test("a selected formation does not reset the map camera on return", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openWorkspace(page, "/formations?onglet=carte");
  const map = page.locator(".leaflet-container:visible");
  await expect(map.locator("canvas")).toBeVisible();
  await page
    .getByRole("button", { name: /^Localiser / })
    .first()
    .click();
  await map.focus();
  const pane = map.locator(".leaflet-map-pane");
  await expect(pane).not.toHaveClass(/leaflet-pan-anim/);
  const initial = await pane.getAttribute("style");
  await page.keyboard.press("ArrowRight");
  await expect.poll(() => pane.getAttribute("style")).not.toBe(initial);
  await expect(pane).not.toHaveClass(/leaflet-pan-anim/);
  const panned = await pane.getAttribute("style");
  const tabs = page.getByRole("tablist", {
    name: "Dans Formations",
    exact: true,
  });
  await tabs.getByRole("tab", { name: "Liste", exact: true }).click();
  await expect(page.getByRole("searchbox")).toBeVisible();
  await tabs.getByRole("tab", { name: "Carte", exact: true }).click();
  await expect(map.locator("canvas")).toBeVisible();
  await expect(pane).toHaveAttribute("style", panned!);
});

test("modality comparison code is downloaded only when that tool is first activated", async ({
  page,
}) => {
  const scripts: Promise<string>[] = [];
  page.on("response", (response) => {
    if (
      response.request().resourceType() === "script" &&
      response.url().includes("/_next/static/")
    )
      scripts.push(response.text().catch(() => ""));
  });
  await openWorkspace(page, "/comparer");
  await expect(
    page.getByRole("tab", { name: "Modalités", exact: true }),
  ).toHaveAttribute("tabindex", "-1");
  expect((await Promise.all(scripts)).join("\n")).not.toContain(
    "Rechercher les formations",
  );
  await page.getByRole("tab", { name: "Modalités", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Rechercher les formations" }),
  ).toBeVisible();
  expect((await Promise.all(scripts)).join("\n")).toContain(
    "Rechercher les formations",
  );
});

test("favorites dossier remains printable", async ({ page }, testInfo) => {
  await openWorkspace(page, "/favoris");
  await page.emulateMedia({ media: "print" });
  await expect(page.locator("#selection-dossier")).toBeVisible();
  await expect(page.locator("#selection-dossier h1")).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("favorites-print.png"),
    fullPage: true,
  });
});

test("shared-list retry refreshes the active entry without remounting its content", async ({
  page,
}) => {
  await openWorkspace(page, "/formations?q=Droit+01&vue=cartes");
  const href = await page
    .getByRole("link", { name: "Licence - Droit 01", exact: true })
    .getAttribute("href");
  const id = decodeURIComponent(href!.split("/").at(-1)!);
  await openWorkspace(page, "/favoris");
  let reads = 0;
  await page.route("**/api/workspace/favoris?*", async (route) => {
    reads++;
    if (reads === 1) {
      await route.fulfill({
        json: {
          kind: "favoris",
          results: [{ id, result: { status: "unavailable" } }],
        },
      });
    } else await route.continue();
  });
  const shared = `/favoris?${new URLSearchParams({ partage: "1", ids: id })}`;
  // A native History destination must resolve inside the mounted workspace.
  await page.evaluate((url) => window.history.pushState(null, "", url), shared);
  const favorites = page.locator("#favoris-contenu");
  await expect(
    favorites.getByText("Aucune formation disponible", { exact: true }),
  ).toBeVisible();
  const originalHeading = await favorites.locator("h1").elementHandle();
  await favorites
    .getByRole("button", { name: "Réessayer", exact: true })
    .click();
  await expect(
    favorites.getByRole("link", { name: "Licence - Droit 01", exact: true }),
  ).toBeVisible();
  await expect(page.locator("main").getByRole("alert")).toHaveCount(0);
  expect(reads).toBe(2);
  expect(
    await originalHeading!.evaluate((element) => element.isConnected),
  ).toBe(true);
});

test("switching representations during a campaign read preserves the requested year", async ({
  page,
}) => {
  await openWorkspace(page, "/formations?campagne=2025");
  let release!: () => void;
  const barrier = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(
    "**/api/workspace/formations?*campagne=2018*",
    async (route) => {
      const response = await route.fetch();
      await barrier;
      await route.fulfill({ response });
    },
  );
  try {
    await page
      .getByRole("button", { name: "Campagne d’admission", exact: true })
      .click();
    await page
      .getByRole("option", { name: "Campagne 2018", exact: true })
      .click();
    await expect(page).toHaveURL(/campagne=2018/);
    await expect(
      page.locator('[role="tabpanel"]:visible > div[aria-busy]'),
    ).toHaveAttribute("aria-busy", "true");
    const tabs = page.getByRole("tablist", {
      name: "Dans Formations",
      exact: true,
    });
    await tabs.getByRole("tab", { name: "Carte", exact: true }).click();
    await expect(page).toHaveURL(/campagne=2018.*onglet=carte/);
    await expect(
      page.getByRole("textbox", { name: "Rechercher dans la carte" }),
    ).toBeVisible();
    await tabs.getByRole("tab", { name: "Liste", exact: true }).click();
    await expect(page).toHaveURL(/campagne=2018/);
    release();
    await expect(
      page.locator('[role="tabpanel"]:visible > div[aria-busy]'),
    ).toHaveAttribute("aria-busy", "false");
    await expect(
      page.getByRole("button", { name: "Campagne d’admission", exact: true }),
    ).toContainText("2018");
    await expect(page).toHaveTitle(/Parcoursup 2018/);
  } finally {
    release();
  }
});
