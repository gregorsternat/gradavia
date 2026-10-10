import AxeBuilder from "@axe-core/playwright";
import { readFile } from "node:fs/promises";
import { expect, test } from "./fixtures";

for (const [family, title] of [
  ["apprentissage", "BTS - Informatique en apprentissage"],
  ["apb", "BTS - Informatique — Services informatiques"],
] as const) {
  test(`${family} analysis table and selection links open published details`, async ({
    page,
  }) => {
    for (const source of ["table", "selection"]) {
      await page.goto(`/analyses?famille=${family}`);
      const table = page.getByRole("table", {
        name: "Formations de l’analyse",
        exact: true,
      });
      if (source === "selection")
        await table.getByRole("button", { name: title, exact: true }).click();
      const link =
        source === "table"
          ? table.getByRole("link", { name: `Ouvrir ${title}`, exact: true })
          : page
              .getByRole("region", { name: "Formation sélectionnée" })
              .getByRole("link", { name: "Ouvrir la fiche", exact: true });
      const href = await link.getAttribute("href");
      expect(href).toMatch(new RegExp(`^/atlas/.+\\?famille=${family}$`));
      await link.focus();
      await page.keyboard.press("Enter");
      await expect(page).toHaveURL((url) => url.pathname + url.search === href);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
      // A direct HTML request must resolve the same published detail as navigation.
      expect((await page.reload())?.status()).toBe(200);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
    }
  });
}

test("analysis URL restores filters on history traversal and clears them on bare-route navigation", async ({
  page,
}) => {
  await page.goto("/analyses");
  const search = page.getByRole("textbox", {
    name: "Formation ou établissement",
  });
  const table = page.getByRole("table", {
    name: "Formations de l’analyse",
    exact: true,
  });
  await expect(search).toBeEnabled();
  await search.focus();
  await search.pressSequentially("Systèmes");
  await expect(search).toBeFocused();
  await expect(search).toHaveValue("Systèmes");
  await expect(table).toHaveAttribute("aria-rowcount", "2");
  const filteredUrl = page.url();
  await page
    .getByRole("link", { name: "Explorer les formations", exact: true })
    .click();
  await expect(page).toHaveURL(/\/formations$/);
  await page.goBack();
  await expect(page).toHaveURL(filteredUrl);
  await expect(search).toHaveValue("Systèmes");
  await expect(table).toHaveAttribute("aria-rowcount", "2");
  await page.keyboard.press("Control+k");
  await page
    .getByRole("dialog", { name: "Recherche rapide" })
    .getByRole("combobox")
    .fill("Atelier d’analyse");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/observatoire\?onglet=analyses$/);
  await expect(search).toHaveValue("");
  await expect(table).toHaveAttribute("aria-rowcount", "32");
  await page.goBack();
  await expect(page).toHaveURL(filteredUrl);
  await expect(search).toHaveValue("Systèmes");
  await expect(table).toHaveAttribute("aria-rowcount", "2");
  await page.goForward();
  await expect(page).toHaveURL(/\/observatoire\?onglet=analyses$/);
  await expect(search).toHaveValue("");
});

test("analysis filters, local views and exported provenance share one cohort", async ({
  page,
  context,
}, testInfo) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/analyses");
  await expect(
    page.getByRole("heading", { name: "Atelier d’analyse", exact: true }),
  ).toBeVisible();
  // The canvas receives its pixel size when the client has drawn the chart.
  await expect(page.getByRole("img", { name: /^Nuage de/ })).toHaveAttribute(
    "width",
    /^[1-9]\d*$/,
  );
  await page.screenshot({
    path: testInfo.outputPath("analysis-workspace.png"),
    fullPage: true,
    caret: "initial",
  });
  await page
    .getByRole("textbox", { name: "Formation ou établissement" })
    .fill("Systèmes numériques");
  const table = page.getByRole("table", {
    name: "Formations de l’analyse",
    exact: true,
  });
  await expect(table).toContainText("BTS - Systèmes numériques");
  await expect(table.getByRole("row")).toHaveCount(2);
  await expect(page).toHaveURL(/version=/);
  await page
    .getByRole("textbox", { name: "Annotation de la vue" })
    .fill("BTS publié — une observation");
  const downloadEvent = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Exporter l’analyse en JSON", exact: true })
    .click();
  const download = await downloadEvent;
  const exported = JSON.parse(await readFile((await download.path())!, "utf8"));
  expect(exported.selectedRowCount).toBe(1);
  expect(exported.records[0].title).toBe("BTS - Systèmes numériques");
  expect(exported.records[0].metrics.capacity).toBe(32);
  expect(exported.filtersAndChart.annotation).toContain("BTS publié");
  expect(exported.source.releaseId).toMatch(/^[a-f0-9-]{36}$/);
  const copy = page.getByRole("button", { name: "Partager", exact: true });
  await copy.click();
  await expect(copy).toHaveAttribute("data-copy-state", "copied");
  const sharedUrl = new URL(
    await page.evaluate(() => navigator.clipboard.readText()),
  );
  expect(sharedUrl.pathname).toBe("/observatoire");
  expect(sharedUrl.searchParams.get("onglet")).toBe("analyses");
  expect(sharedUrl.searchParams.get("version")).toBe(exported.source.releaseId);
  expect(sharedUrl.searchParams.get("q")).toBe("Systèmes numériques");
  await page
    .getByRole("button", { name: "Vues et cohortes enregistrées" })
    .click();
  await page
    .getByRole("textbox", { name: "Nom de la vue" })
    .fill("BTS numérique");
  await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "BTS numérique", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("textbox", { name: "Annotation de la vue" }),
  ).toHaveValue("BTS publié — une observation");
  await expect(table.getByRole("row")).toHaveCount(2);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("analysis tabs preserve their first activation after delayed hydration", async ({
  page,
}) => {
  let hydrate!: () => void;
  const hydration = new Promise<void>((resolve) => {
    hydrate = resolve;
  });
  await page.route("**/_next/static/**/*.js", async (route) => {
    await hydration;
    await route.continue();
  });
  try {
    await page.goto("/analyses?vue=matrix", { waitUntil: "commit" });
    const distribution = page.getByRole("tab", {
      name: "Distribution",
      exact: true,
    });
    await expect(distribution).toBeDisabled();
    hydrate();
    await expect(distribution).toBeEnabled();
    await distribution.click();
    await expect(distribution).toHaveAttribute("aria-selected", "true");
    await expect(page).toHaveURL(/vue=distribution/);
    await page
      .getByRole("button", { name: "Voir les valeurs", exact: true })
      .click();
    await expect(
      page.getByRole("table", {
        name: "Distribution des formations",
        exact: true,
      }),
    ).toBeVisible();
    await distribution.focus();
    await page.keyboard.press("End");
    await expect(
      page.getByRole("tab", { name: "Qualité", exact: true }),
    ).toHaveAttribute("aria-selected", "true");
    await expect(page).toHaveURL(/vue=quality/);
  } finally {
    hydrate();
  }
});

test("analysis views expose keyboard-accessible values and missingness", async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "dark" });
  await page.goto("/analyses?vue=matrix");
  await expect(
    page.getByRole("table", { name: "Tableau croisé des formations" }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Distribution", exact: true }).click();
  await page
    .getByRole("button", { name: "Voir les valeurs", exact: true })
    .click();
  await expect(
    page.getByRole("table", {
      name: "Distribution des formations",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await expect(
    page.locator(".gradavia-chart .recharts-cartesian-axis-tick-value").first(),
  ).not.toHaveCSS("fill", "rgb(0, 0, 0)");
  const tickFill = await page
    .locator(".gradavia-chart .recharts-cartesian-axis-tick-value")
    .first()
    .evaluate((node) => getComputedStyle(node).fill);
  await expect(
    page.locator(".gradavia-chart .gradavia-axis-label").first(),
  ).toHaveCSS("fill", tickFill);
  await page.screenshot({
    path: testInfo.outputPath("analysis-distribution-dark.png"),
    fullPage: true,
    caret: "initial",
  });
  await page.getByRole("tab", { name: "Qualité", exact: true }).click();
  await page
    .getByRole("button", { name: "Voir les valeurs", exact: true })
    .click();
  await expect(
    page.getByRole("table", { name: "États des valeurs", exact: true }),
  ).toContainText("Masqué");
  const indicator = page.getByRole("button", {
    name: "Indicateur analysé",
    exact: true,
  });
  await indicator.focus();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Escape");
  await expect(indicator).toBeFocused();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("source quiz reveals real denominators and links to the pinned analysis", async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/decouvrir");
  await expect(
    page.getByRole("heading", { name: "À votre avis ?", exact: true }),
  ).toBeVisible();
  const slider = page.getByRole("slider", {
    name: "Votre estimation en pourcentage",
  });
  await expect(slider).toBeEnabled();
  await slider.focus();
  await page.keyboard.press("Home");
  await expect(slider).toHaveAttribute("aria-valuenow", "0");
  await page.keyboard.press("End");
  await expect(slider).toHaveAttribute("aria-valuenow", "100");
  await page
    .getByRole("button", { name: "Révéler les données", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("93,5 %");
  await expect(
    page.getByRole("main").getByText(/29 lignes sur 31/),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Explorer la réponse", exact: true }),
  ).toHaveAttribute("href", /version=.*indicateur=records/);
  await page.screenshot({
    path: testInfo.outputPath("discovery-reveal.png"),
    fullPage: true,
    caret: "initial",
  });
  await page
    .getByRole("button", { name: "Question suivante", exact: true })
    .click();
  await expect(page.getByRole("heading", { level: 2 })).toContainText(
    "places observées",
  );
  await expect(page.getByRole("status")).toHaveCount(0);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
