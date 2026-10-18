import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "./fixtures";

test("evolution URL restores settings on history traversal and resets bare-route navigation", async ({
  page,
}) => {
  await page.goto("/evolutions");
  const measure = page.getByRole("button", { name: "Indicateur", exact: true });
  const mode = page.getByRole("button", {
    name: "Affichage des graphiques",
    exact: true,
  });
  await measure.click();
  await page.getByRole("option", { name: "Candidatures", exact: true }).click();
  await mode.click();
  await page
    .getByRole("option", { name: "Indice base 100", exact: true })
    .click();
  await expect(measure).toContainText("Candidatures");
  await expect(mode).toContainText("Indice base 100");
  const filteredUrl = page.url();
  await page
    .getByRole("link", { name: "Explorer les formations", exact: true })
    .click();
  await expect(page).toHaveURL(/\/formations$/);
  await page.goBack();
  await expect(page).toHaveURL(filteredUrl);
  await expect(measure).toContainText("Candidatures");
  await expect(mode).toContainText("Indice base 100");
  await page.keyboard.press("Control+k");
  await page
    .getByRole("dialog", { name: "Recherche rapide" })
    .getByRole("combobox")
    .fill("Comparer les campagnes");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/observatoire\?onglet=evolutions$/);
  await expect(measure).toContainText("Places");
  await expect(mode).toContainText("Effectifs");
  await page.goBack();
  await expect(page).toHaveURL(filteredUrl);
  await expect(measure).toContainText("Candidatures");
  await expect(mode).toContainText("Indice base 100");
  await page.goForward();
  await expect(page).toHaveURL(/\/observatoire\?onglet=evolutions$/);
  await expect(measure).toContainText("Places");
  await expect(mode).toContainText("Effectifs");
});

test("evolution compares exactly matched fixture observations and preserves indices", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/evolutions?debut=2023&fin=2024");
  await expect(
    page.getByRole("heading", { name: "Évolutions", exact: true }),
  ).toBeVisible();
  const table = page.getByRole("table", {
    name: "Évolutions des formations suivies",
    exact: true,
  });
  await expect(table).toContainText("Licence - Droit");
  await expect(table).toContainText("150");
  await expect(table).toContainText("160");
  await expect(table).toContainText("+10");
  await expect(
    page.getByRole("tab", { name: "Deux campagnes", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Lecture", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("tab", { name: "Par filière", exact: true }).click();
  await expect(
    page.getByRole("tabpanel", { name: "Par filière", exact: true }),
  ).toContainText("deux observations");
  await page.getByRole("tab", { name: "Avant / après", exact: true }).click();
  await page
    .getByRole("button", { name: "Affichage des graphiques", exact: true })
    .click();
  await page
    .getByRole("option", { name: "Indice base 100", exact: true })
    .click();
  await expect(page).toHaveURL(/version_debut=/);
  await expect(page).toHaveURL(/mode=index/);
  const copy = page.getByRole("button", { name: /^(Partager|Lien copié)$/ });
  await copy.click();
  await expect(copy).toHaveText("Lien copié");
  const copiedUrl = new URL(
    await page.evaluate(() => navigator.clipboard.readText()),
  );
  const displayedUrl = new URL(page.url());
  expect(copiedUrl.pathname).toBe("/observatoire");
  expect(copiedUrl.searchParams.get("version_debut")).toBeTruthy();
  expect(copiedUrl.searchParams.get("version_fin")).toBeTruthy();
  expect(copiedUrl.search).toBe(displayedUrl.search);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Affichage des graphiques", exact: true }),
  ).toContainText("Indice base 100");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("changed descriptions stay outside the followed cohort", async ({
  page,
}) => {
  await page.goto("/evolutions?debut=2024&fin=2025");
  await expect(
    page
      .getByRole("region", { name: "Périmètre suivi" })
      .getByText("Aucune paire exploitable", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Décomposition du périmètre source" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("table", {
      name: "Évolutions des formations suivies",
      exact: true,
    }),
  ).toHaveAttribute("aria-rowcount", "1");
});
