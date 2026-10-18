import { expect, test } from "./fixtures";

// Enlarge only the browser fixture response: production tables must cross several
// batch boundaries even when the real fixture has fewer than 25 observations.
const localTables = [
  {
    panel: "specialites",
    entry: "/specialites/inverse",
    tab: "Depuis mes spécialités",
    back: "Depuis une formation",
    name: "Groupes par combinaison de spécialités",
  },
  {
    panel: "inverse",
    entry: "/specialites",
    tab: "Depuis une formation",
    back: "Depuis mes spécialités",
    name: "Combinaisons par formation nationale",
  },
  {
    panel: "territoires",
    entry: "/observatoire?onglet=analyses",
    tab: "Territoires",
    back: "Vue d’ensemble",
    name: "Indicateurs par région",
  },
  {
    panel: "evolutions",
    entry: "/observatoire",
    tab: "Évolutions",
    back: "Vue d’ensemble",
    name: "Évolutions des formations suivies",
  },
];
for (const scenario of localTables) {
  test(`${scenario.panel} automatically reveals three local batches and preserves inactive rows`, async ({
    page,
    isMobile,
  }) => {
    await page.emulateMedia({
      reducedMotion: "reduce",
      colorScheme: isMobile ? "dark" : "light",
    });
    await page.route(`**/api/workspace/${scenario.panel}*`, async (route) => {
      let response = await route.fetch();
      let payload = await response.json();
      if (scenario.panel === "inverse") {
        const query = new URLSearchParams({
          formation: payload.result.data.formations[0].id,
        });
        response = await route.fetch({
          url: `${new URL(route.request().url()).origin}/api/workspace/inverse?${query}`,
        });
        payload = await response.json();
      }
      if (scenario.panel === "evolutions") {
        response = await route.fetch({
          url: `${new URL(route.request().url()).origin}/api/workspace/evolutions?debut=2023&fin=2024`,
        });
        payload = await response.json();
      }
      const data = payload.result.data;
      const field = {
        specialites: "groups",
        inverse: "rows",
        territoires: "byRegion",
        evolutions: "matched",
      }[scenario.panel]!;
      const first = data[field][0];
      expect(first).toBeTruthy();
      data[field] = Array.from({ length: 61 }, (_, index) => {
        const suffix = String(index + 1).padStart(2, "0");
        return {
          ...first,
          id: `${data.source?.releaseId ?? "fixture"}:${index + 1}`,
          ...(scenario.panel === "specialites"
            ? { group: `Groupe ${suffix}` }
            : {}),
          ...(scenario.panel === "inverse"
            ? {
                pair: {
                  ...first.pair,
                  id: `pair-${suffix}`,
                  label: `Combinaison ${suffix}`,
                },
              }
            : {}),
          ...(scenario.panel === "territoires"
            ? { label: `Région ${suffix}` }
            : {}),
          ...(scenario.panel === "evolutions"
            ? {
                title: `Formation ${suffix}`,
                before: { ...first.before, id: `before-${suffix}` },
                after: { ...first.after, id: `after-${suffix}` },
              }
            : {}),
        };
      });
      await route.fulfill({ json: payload });
    });
    await page.goto(scenario.entry);
    await page.getByRole("tab", { name: scenario.tab, exact: true }).click();
    const table = page.getByRole("table", { name: scenario.name, exact: true });
    const region = page.getByRole("region", {
      name: scenario.name,
      exact: true,
    });
    const progress = page.locator("[data-load-progress]:visible").first();
    await expect(table).toHaveAttribute("aria-rowcount", "62");
    await expect(progress).toContainText("25 résultats affichés sur 61");
    await expect(
      page.getByRole("button", { name: "Charger la suite", exact: true }),
    ).toHaveCount(0);
    await region.evaluate((element) => {
      element.scrollTop = element.scrollHeight;
    });
    await expect(progress).toContainText("50 résultats affichés sur 61");
    const position = await region.evaluate((element) => element.scrollTop);
    await page.getByRole("tab", { name: scenario.back, exact: true }).click();
    await expect(table).toBeHidden();
    await page.getByRole("tab", { name: scenario.tab, exact: true }).click();
    await expect(progress).toContainText("50 résultats affichés sur 61");
    expect(await region.evaluate((element) => element.scrollTop)).toBe(
      position,
    );
    await region.focus();
    await page.keyboard.press("End");
    await expect(progress).toContainText(
      "61 résultats affichés sur 61 · Fin des résultats",
    );
    await region.focus();
    await page.keyboard.press("End");
    await expect(table.locator('tr[aria-rowindex="62"]')).toHaveCount(1);
    await page.keyboard.press("Home");
    await expect(table.locator('tr[aria-rowindex="2"]')).toHaveCount(1);
  });
}

test("atlas cards automatically reveal every batch without a manual action", async ({
  page,
}) => {
  await page.route("https://*.basemaps.cartocdn.com/**", (route) =>
    route.abort(),
  );
  await page.goto("/carte");
  const progress = page.locator("[data-load-progress]:visible");
  await expect(progress).toContainText("20 résultats affichés sur 31");
  await expect(
    page.getByRole("button", { name: "Charger la suite", exact: true }),
  ).toHaveCount(0);
  await progress.scrollIntoViewIfNeeded();
  await expect(progress).toContainText(
    "31 résultats affichés sur 31 · Fin des résultats",
  );
  await expect(page.getByRole("article")).toHaveCount(31);
});

test("shared favorite cards automatically fetch all three batches once", async ({
  page,
  request,
}) => {
  const payload = await (await request.get("/api/workspace/carte")).json();
  const ids = payload.result.data.items.map((item: { id: string }) => item.id);
  const requested: string[] = [];
  await page.route("**/api/workspace/favoris?**", async (route) => {
    requested.push(
      new URL(route.request().url()).searchParams.get("ids") ?? "",
    );
    await route.continue();
  });
  await page.goto(
    `/favoris?${new URLSearchParams({ ids: ids.join(","), partage: "1" })}`,
  );
  const progress = page.locator("[data-load-progress]:visible");
  await expect(progress).toContainText("12 résultats affichés sur 31");
  await progress.scrollIntoViewIfNeeded();
  await expect(progress).toContainText("24 résultats affichés sur 31");
  await progress.scrollIntoViewIfNeeded();
  await expect(progress).toContainText(
    "31 résultats affichés sur 31 · Fin des résultats",
  );
  await expect(page.getByRole("article")).toHaveCount(31);
  await expect(
    page.getByRole("button", { name: "Charger la suite", exact: true }),
  ).toHaveCount(0);
  expect(requested).toHaveLength(2);
  expect(new Set(requested.flatMap((value) => value.split(","))).size).toBe(19);
});

const skeletonPanels = [
  { entry: "/formations", panel: "carte", tab: "Carte" },
  { entry: "/formations?onglet=carte", panel: "formations", tab: "Liste" },
  {
    entry: "/formations?onglet=carte",
    panel: "apprentissage-carte",
    tab: "Carte",
  },
  {
    entry: "/formations",
    panel: "apprentissage",
    tab: "Liste",
  },
  {
    entry: "/specialites?onglet=formation",
    panel: "specialites",
    tab: "Depuis mes spécialités",
  },
  { entry: "/specialites", panel: "inverse", tab: "Depuis une formation" },
  {
    entry: "/comparer?onglet=modalites",
    panel: "selection",
    tab: "Ma sélection",
  },
  { entry: "/comparer", panel: "modalites", tab: "Modalités" },
  {
    entry: "/observatoire?onglet=analyses",
    panel: "overview",
    tab: "Vue d’ensemble",
  },
  {
    entry: "/observatoire?onglet=analyses",
    panel: "territoires",
    tab: "Territoires",
  },
  { entry: "/observatoire", panel: "evolutions", tab: "Évolutions" },
  { entry: "/observatoire", panel: "analyses", tab: "Atelier d’analyse" },
  {
    entry: "/sources?onglet=archives",
    panel: "sources",
    tab: "Sources et définitions",
  },
  {
    entry: "/sources?onglet=archives",
    panel: "donnees",
    tab: "API et notebooks",
  },
  { entry: "/sources", panel: "archives", tab: "Archives APB" },
];
for (const scenario of skeletonPanels) {
  test(`tailored skeleton for ${scenario.panel} preserves navigation while data waits`, async ({
    page,
    isMobile,
  }, testInfo) => {
    await page.emulateMedia({
      colorScheme: isMobile ? "dark" : "light",
      reducedMotion: "reduce",
    });
    await page.route("https://*.basemaps.cartocdn.com/**", (route) =>
      route.fulfill({ status: 204 }),
    );
    await page.goto(scenario.entry);
    const tab = page
      .getByRole("tablist")
      .first()
      .getByRole("tab", { name: scenario.tab, exact: true });
    const switchingFamily = scenario.panel.startsWith("apprentissage");
    if (switchingFamily)
      await expect(
        page.getByRole("button", { name: "Périmètre des formations" }),
      ).toBeEnabled();
    else await expect(tab).toHaveAttribute("tabindex", "-1");
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route(`**/api/workspace/${scenario.panel}?*`, async (route) => {
      const response = await route.fetch();
      await gate;
      await route.fulfill({ response });
    });
    try {
      if (switchingFamily) {
        await page
          .getByRole("button", { name: "Périmètre des formations" })
          .click();
        await page
          .getByRole("option", { name: "Apprentissage", exact: true })
          .click();
      } else {
        await tab.focus();
        await page.keyboard.press("Enter");
      }
      const skeleton = page.locator(`[data-skeleton="${scenario.panel}"]`);
      await expect(skeleton).toBeVisible();
      if (!switchingFamily) await expect(tab).toBeFocused();
      await expect(skeleton.getByRole("status")).toHaveCount(1);
      await expect(
        skeleton.locator("input, button, a, [tabindex]"),
      ).toHaveCount(0);
      expect(
        await skeleton
          .locator(".skeleton")
          .first()
          .evaluate((el) => getComputedStyle(el, "::after").animationName),
      ).toBe("none");
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      if (["carte", "territoires"].includes(scenario.panel)) {
        await page.screenshot({
          path: testInfo.outputPath(`${scenario.panel}-skeleton.png`),
        });
        await page.emulateMedia({
          colorScheme: isMobile ? "light" : "dark",
          reducedMotion: "no-preference",
        });
        expect(
          await skeleton
            .locator(".skeleton")
            .first()
            .evaluate((el) => getComputedStyle(el, "::after").animationName),
        ).toBe("skeleton-reflection");
        await page.screenshot({
          path: testInfo.outputPath(`${scenario.panel}-alternate-theme.png`),
        });
      }
    } finally {
      release();
    }
    await expect(
      page.locator(`[data-skeleton="${scenario.panel}"]`),
    ).toHaveCount(0);
    await expect(tab).toHaveAttribute("aria-selected", "true");
  });
}

test("refresh keeps formation results mounted and replaces loading copy with a stable indicator", async ({
  page,
}) => {
  await page.goto("/formations?vue=cartes");
  const search = page.getByRole("searchbox");
  await expect(search).toBeEditable();
  const firstLink = page
    .getByRole("article")
    .first()
    .locator('a[href^="/formations/"]')
    .first();
  await expect(firstLink).toBeVisible();
  const original = await firstLink.elementHandle();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/workspace/formations?*", async (route) => {
    const response = await route.fetch();
    await gate;
    await route.fulfill({ response });
  });
  try {
    await search.fill("Licence");
    await search.press("Enter");
    await expect(page.locator("[data-refresh-indicator]")).toBeVisible();
    expect(await original!.evaluate((el) => el.isConnected)).toBe(true);
    await expect(firstLink).toBeVisible();
    await expect(search).toHaveValue("Licence");
    await expect(page.locator('[data-skeleton="formations"]')).toHaveCount(0);
  } finally {
    release();
  }
  await expect(page.locator("[data-refresh-indicator]")).toHaveCount(0);
  await expect(search).toBeEditable();
  await expect(search).toHaveValue("Licence");
});

test("tailored skeleton also covers a delayed tool module after its data arrives", async ({
  page,
}) => {
  await page.goto("/comparer");
  const modalities = page.getByRole("tab", { name: "Modalités", exact: true });
  await expect(modalities).toHaveAttribute("tabindex", "-1");
  await page.waitForLoadState("networkidle");
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let held = false;
  await page.route("**/*.js*", async (route) => {
    const response = await route.fetch();
    const body = await response.text();
    if (body.includes("Rechercher les formations")) {
      held = true;
      await gate;
    }
    await route.fulfill({ response });
  });
  try {
    const data = page.waitForResponse((response) =>
      response.url().includes("/api/workspace/modalites?"),
    );
    await modalities.click();
    await data;
    await expect.poll(() => held).toBe(true);
    await expect(page.locator('[data-skeleton="modalites"]')).toBeVisible();
    await expect(page.locator('[data-skeleton="modalites"]')).toHaveCount(1);
  } finally {
    release();
  }
  await expect(
    page.getByRole("button", { name: "Rechercher les formations" }),
  ).toBeEnabled();
  await expect(page.locator('[data-skeleton="modalites"]')).toHaveCount(0);
});
