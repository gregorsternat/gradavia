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
  await expect(page).toHaveURL(/\/evolutions$/);
  await expect(measure).toContainText("Places");
  await expect(mode).toContainText("Effectifs");
  await page.goBack();
  await expect(page).toHaveURL(filteredUrl);
  await expect(measure).toContainText("Candidatures");
  await expect(mode).toContainText("Indice base 100");
  await page.goForward();
  await expect(page).toHaveURL(/\/evolutions$/);
  await expect(measure).toContainText("Places");
  await expect(mode).toContainText("Effectifs");
});

test("evolution compares exactly matched fixture observations and preserves indices", async ({
  page,
}) => {
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
  await page.getByRole("tab", { name: "Deux campagnes", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Lecture", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("tabpanel", { name: "Deux campagnes" })
    .getByRole("button", { name: "2024", exact: true })
    .click();
  await expect(page.getByText("Campagne 2024", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Affichage des graphiques", exact: true })
    .click();
  await page
    .getByRole("option", { name: "Indice base 100", exact: true })
    .click();
  await expect(page).toHaveURL(/version_debut=/);
  await expect(page).toHaveURL(/mode=index/);
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
  await page
    .getByRole("button", {
      name: "Décomposition du périmètre source",
      exact: true,
    })
    .click();
  const table = page.getByRole("table", {
    name: "Décomposition de la variation des sources",
    exact: true,
  });
  await expect(table).toContainText("Description modifiée");
  await expect(table).toContainText("Identifiants ambigus");
  await expect(
    page.getByRole("table", {
      name: "Évolutions des formations suivies",
      exact: true,
    }),
  ).toHaveAttribute("aria-rowcount", "1");
});
