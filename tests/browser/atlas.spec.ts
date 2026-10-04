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
  await expect(page.locator(".leaflet-container canvas")).toBeVisible();
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
    page.getByText("Aucune formation ne correspond à ces critères."),
  ).toBeVisible();
  await page.getByRole("spinbutton", { name: "Places maximum" }).fill("40");
  await expect(
    page
      .getByRole("region", { name: "Formations de la carte" })
      .getByRole("link", { name: "BTS - Systèmes numériques" }),
  ).toBeVisible();
  await page.getByRole("combobox", { name: "Autour d’une ville" }).fill("Lyon");
  await expect(page).not.toHaveURL(/ville=/);
  await page.getByRole("option", { name: "Lyon · Rhône", exact: true }).click();
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
  await search.pressSequentially("Systèmes numériques");
  await expect(search).toHaveValue("Systèmes numériques");
  const filtered = page.url();
  const navigation = page.getByRole("link", { name: "Carte", exact: true });
  if (!(await navigation.isVisible()))
    await page
      .getByRole("button", { name: "Afficher ou masquer la navigation" })
      .click();
  await navigation.click();
  await expect(page).toHaveURL(/\/carte$/);
  await expect(search).toHaveValue("");
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
  await expect(page.getByText("Masqué", { exact: true }).first()).toBeVisible();
  await page.goto("/archives");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Explorer les archives APB",
  );
  await expect(page.locator(".leaflet-container")).toHaveCount(0);
  await page
    .getByRole("region", { name: "Formations de la carte" })
    .getByRole("link")
    .first()
    .click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("BTS");
  await expect(
    page.getByText(/Le dénominateur diffère de celui de Parcoursup/),
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
    page.getByText(/Alternatives à Licence - Droit 01/),
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
