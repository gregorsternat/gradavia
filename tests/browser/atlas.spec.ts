import { test, expect } from "./fixtures";

test.beforeEach(async ({ page }) => {
  // Map interaction tests use local source records and never depend on a tile service.
  await page.route("https://tile.openstreetmap.org/**", (route) =>
    route.fulfill({
      contentType: "image/png",
      body: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jR1EAAAAASUVORK5CYII=",
        "base64",
      ),
    }),
  );
});

test("map filters keep the complete snapshot, radius and share URL synchronized", async ({
  page,
}) => {
  await page.goto("/carte");
  await expect(
    page.getByRole("heading", { name: "Explorer la carte", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".leaflet-container:visible canvas")).toBeVisible();
  await page
    .getByRole("button", { name: "Cadrer les résultats", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Rechercher dans la carte" })
    .fill("Systèmes numériques");
  await expect(
    page
      .getByRole("region", { name: "Formations de la carte" })
      .getByRole("link", { name: "BTS - Systèmes numériques" }),
  ).toBeVisible();
  await expect(page).toHaveURL(/q=Syst/);
  await page.getByRole("button", { name: "Proximité et critères" }).click();
  await page.getByRole("spinbutton", { name: "Places maximum" }).fill("0");
  await expect(
    page
      .getByRole("main")
      .getByText("Aucune formation ne correspond à ces critères."),
  ).toBeVisible();
  await page.getByRole("spinbutton", { name: "Places maximum" }).fill("40");
  await expect(
    page
      .getByRole("region", { name: "Formations de la carte" })
      .getByRole("link", { name: "BTS - Systèmes numériques" }),
  ).toBeVisible();
  const cityInput = page.getByRole("combobox", { name: "Autour d’une ville" });
  await cityInput.fill("rhone");
  await expect(page.getByRole("option")).toHaveCount(1);
  await cityInput.fill("Lyon");
  await expect(page).not.toHaveURL(/ville=/);
  await expect(
    page.getByRole("option", { name: "Lyon · Rhône", exact: true }),
  ).toBeVisible();
  await cityInput.press("ArrowDown");
  await cityInput.press("Enter");
  await expect(page).toHaveURL(/ville=Lyon/);
  const radiusInput = page.getByRole("spinbutton", {
    name: "Rayon exact en kilomètres",
  });
  await radiusInput.fill("750");
  await expect(radiusInput).toHaveValue("500");
  await radiusInput.fill("12");
  await expect(
    page.getByRole("slider", { name: "Rayon en kilomètres" }),
  ).toHaveAttribute("aria-valuenow", "12");
  await page.getByRole("slider", { name: "Rayon en kilomètres" }).focus();
  await page.keyboard.press("Home");
  await expect(
    page.getByRole("slider", { name: "Rayon en kilomètres" }),
  ).toHaveAttribute("aria-valuenow", "1");
  await page.reload();
  await expect(
    page.getByRole("textbox", { name: "Rechercher dans la carte" }),
  ).toHaveValue("Systèmes numériques");
  await expect(page).toHaveURL(/version=/);
  await expect(page.locator("body")).toHaveJSProperty(
    "scrollWidth",
    await page.locator("body").evaluate((element) => element.clientWidth),
  );
});

test("map filters follow internal navigation and browser history", async ({
  page,
}) => {
  await page.goto("/carte");
  const search = page.getByRole("textbox", {
    name: "Rechercher dans la carte",
  });
  await expect(search).toBeEnabled();
  await search.pressSequentially("Systèmes numériques");
  await expect(search).toHaveValue("Systèmes numériques");
  const filtered = page.url();
  const navigation = page
    .getByRole("navigation", { name: "Explorer Gradavia" })
    .getByRole("link", { name: "Formations", exact: true });
  if (!(await navigation.isVisible()))
    await page
      .getByRole("button", { name: "Afficher ou masquer la navigation" })
      .click();
  await navigation.click();
  await expect(page).toHaveURL(/\/formations$/);
  await page.goBack();
  await expect(page).toHaveURL(filtered);
  await expect(search).toHaveValue("Systèmes numériques");
  await expect(
    page
      .getByRole("region", { name: "Formations de la carte" })
      .getByRole("link", { name: "BTS - Systèmes numériques", exact: true }),
  ).toBeVisible();
});

test("apprenticeship and APB stay separate and retain missing indicators", async ({
  page,
}) => {
  await page.goto("/apprentissage");
  await page
    .getByRole("region", { name: "Formations de la carte" })
    .getByRole("link", { name: "BTS - Informatique en apprentissage" })
    .click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "BTS - Informatique en apprentissage",
  );
  await expect(
    page.getByRole("main").getByText("Masqué", { exact: true }).first(),
  ).toBeVisible();
  await page.goto("/archives");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Explorer les archives APB",
  );
  await expect(page.locator(".leaflet-container:visible")).toHaveCount(0);
  await page
    .getByRole("region", { name: "Formations de la carte" })
    .getByRole("link")
    .first()
    .click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("BTS");
  await expect(
    page
      .getByRole("main")
      .getByText(/Le dénominateur diffère de celui de Parcoursup/),
  ).toBeVisible();
});

test("formation profiles expose observed mentions, rank groups and explicit peers", async ({
  page,
}) => {
  await page.goto("/formations?q=Droit%2001");
  await page
    .getByRole("link", { name: "Licence - Droit 01", exact: true })
    .click();
  await page.getByRole("tab", { name: "Profils et alternatives" }).click();
  await expect(
    page.getByRole("heading", { name: "Mentions au baccalauréat" }),
  ).toBeVisible();
  await expect(
    page.getByRole("table", { name: "Mentions au baccalauréat" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Rang du dernier appelé", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Parmi les formations similaires" }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Explorer toutes les alternatives" })
    .click();
  await expect(page).toHaveURL(/similaire=/);
  await expect(
    page.getByRole("main").getByText(/Alternatives à Licence - Droit 01/),
  ).toBeVisible();
});

test("cross-modality comparison pins each publication and preserves suppression", async ({
  page,
}) => {
  await page.goto(
    "/modalites?q_classique=Syst%C3%A8mes%20num%C3%A9riques&q_apprenti=Informatique",
  );
  await page
    .getByRole("region", { name: "Hors apprentissage", exact: true })
    .getByRole("link")
    .first()
    .click();
  await page
    .getByRole("region", { name: "Apprentissage", exact: true })
    .getByRole("link")
    .first()
    .click();
  const table = page.getByRole("table", { name: "Comparaison des modalités" });
  await expect(
    table.getByRole("row").filter({ hasText: "Propositions" }),
  ).toContainText("Masqué");
  await expect(
    table.getByRole("row").filter({ hasText: "Admis" }),
  ).toContainText("Non publié");
  await expect(
    page.getByRole("button", { name: "Changer de formation", exact: true }),
  ).toHaveCount(2);
  await expect(page).toHaveURL(/classique=[^&]+%3A\d+/);
  await expect(page).toHaveURL(/apprenti=[^&]+%3A\d+/);
  await page.reload();
  await expect(table).toBeVisible();
  await expect(page.locator("body")).toHaveJSProperty(
    "scrollWidth",
    await page.locator("body").evaluate((element) => element.clientWidth),
  );
});

test("list and map share compatible filters while apprenticeship keeps its snapshot", async ({
  page,
}) => {
  await page.goto("/formations?campagne=2025&q=BTS&type=BTS&tri=capacite");
  const views = page.getByRole("tablist", {
    name: "Dans Formations",
  });
  await expect(
    page.getByRole("button", { name: "Périmètre des formations" }),
  ).toBeEnabled();
  await views.getByRole("tab", { name: "Carte", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(
    /\/formations\?campagne=2025&q=BTS&type=BTS&tri=capacity&onglet=carte$/,
  );
  await expect(
    page.getByRole("textbox", { name: "Rechercher dans la carte" }),
  ).toHaveValue("BTS");
  await views.getByRole("tab", { name: "Liste", exact: true }).click();
  await expect(page).toHaveURL(
    /\/formations\?campagne=2025&q=BTS&type=BTS&tri=capacite$/,
  );
  await page.getByRole("button", { name: "Périmètre des formations" }).click();
  await page
    .getByRole("option", { name: "Apprentissage", exact: true })
    .click();
  await expect(page).toHaveURL(/\/formations\?q=BTS&famille=apprentissage$/);
  await expect(page.locator(".leaflet-container:visible")).toHaveCount(0);
  await expect(
    page.getByRole("link", {
      name: "BTS - Informatique en apprentissage",
      exact: true,
    }),
  ).toBeVisible();
  const locate = page.getByRole("button", {
    name: "Localiser BTS - Informatique en apprentissage",
    exact: true,
  });
  await expect(locate).toHaveCount(0);
  await views.getByRole("tab", { name: "Carte", exact: true }).click();
  await expect(page.locator(".leaflet-container:visible canvas")).toBeVisible();
  await expect(locate).toBeVisible();
  await locate.click();
  const release = new URL(page.url()).searchParams.get("version");
  expect(release).toBeTruthy();
  await views.getByRole("tab", { name: "Liste", exact: true }).click();
  expect(new URL(page.url()).searchParams.has("onglet")).toBe(false);
  await expect(page.locator(".leaflet-container:visible")).toHaveCount(0);
  expect(new URL(page.url()).searchParams.get("version")).toBe(release);
  await expect(locate).toHaveCount(0);
  await page.reload();
  await expect(page.locator(".leaflet-container:visible")).toHaveCount(0);
  await expect(locate).toHaveCount(0);
  await expect(
    page.getByRole("textbox", { name: "Rechercher dans la carte" }),
  ).toHaveValue("BTS");
});

test("legacy APB map links retain their filters under methodology", async ({
  page,
}) => {
  await page.goto("/carte?famille=apb&campagne=2017&q=BTS");
  await expect(page).toHaveURL(
    /\/sources\?campagne=2017&q=BTS&onglet=archives$/,
  );
  await expect(
    page.getByRole("tablist", { name: "Dans Données & méthode" }),
  ).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Rechercher dans la carte" }),
  ).toHaveValue("BTS");
});
