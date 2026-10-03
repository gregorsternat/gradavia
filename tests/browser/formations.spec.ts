import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "./fixtures";

test("explorer is accessible with provenance and a bounded results page", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Explorer les formations" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Explorer les formations",
  );
  await expect(page.getByLabel("Campagne d’admission")).toHaveValue("2025");
  await expect(page.getByRole("status")).toContainText("31 résultats");
  await expect(page.getByRole("article")).toHaveCount(25);
  await expect(
    page.getByRole("region", { name: "Sources et périmètre" }),
  ).toContainText("Fixtures synthétiques");
  await expect(
    page.getByText("Lien Parcoursup indisponible", { exact: true }),
  ).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("radio", { name: "Sombre", exact: true }).check();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("search, shared URLs and browser history preserve the visible state", async ({
  page,
}) => {
  await page.goto("/formations");
  const input = page.getByRole("searchbox");
  await input.fill("ecole etampes");
  await page.getByRole("button", { name: "Rechercher", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("2 résultats");
  await expect(page).toHaveURL(/q=ecole\+etampes/);
  const shared = page.url();
  await page.reload();
  await expect(input).toHaveValue("ecole etampes");
  await input.fill("introuvable");
  await page.getByRole("button", { name: "Rechercher", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: "Aucune formation ne correspond à votre recherche.",
    }),
  ).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(shared);
  await expect(input).toHaveValue("ecole etampes");
  await expect(page.getByRole("status")).toContainText("2 résultats");
});

test("filters combine, pagination is stable and new searches reset the page", async ({
  page,
  isMobile,
}) => {
  await page.goto("/formations");
  await page.getByRole("link", { name: /suivante/i }).click();
  await expect(page.getByText("Page 2 sur 2")).toBeVisible();
  await expect(page.getByRole("article")).toHaveCount(6);
  if (isMobile) await page.locator("summary").click();
  await page
    .getByLabel("Type de formation", { exact: true })
    .selectOption("Licence");
  await page
    .getByLabel("Région", { exact: true })
    .selectOption("Ile-de-France");
  await page.getByLabel("Département", { exact: true }).selectOption("Essonne");
  await page.getByRole("button", { name: "Appliquer les filtres" }).click();
  await expect(page.getByRole("status")).toContainText("2 résultats");
  expect(new URL(page.url()).searchParams.has("page")).toBe(false);
  await expect(page.getByRole("article")).toHaveCount(2);
});

test("campaign changes reset the search and explain historical gaps", async ({
  page,
  isMobile,
}) => {
  await page.goto("/formations?campagne=2025&q=droit&type=Licence&page=2");
  await page.getByLabel("Campagne d’admission").selectOption("2018");
  await page.getByRole("button", { name: "Afficher", exact: true }).click();
  await expect(page).toHaveURL(/\/formations\?campagne=2018$/);
  await expect(page.getByRole("searchbox")).toHaveValue("");
  if (isMobile) await page.locator("summary").click();
  await expect(page.getByLabel("Statut de l’établissement")).toBeDisabled();
  await expect(page.getByLabel("Sélectivité", { exact: true })).toBeDisabled();
  await expect(
    page.getByText("Ville non renseignée", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Licence - Droit — Droit — Parcours européen",
    }),
  ).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("keyboard and reduced motion preserve search and filter access", async ({
  page,
  isMobile,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/formations");
  await expect(page.getByRole("status")).toContainText("31 résultats");
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Aller au contenu" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#contenu$/);
  if (isMobile) {
    await page.locator("summary").focus();
    await expect(page.locator("summary")).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(
      page.getByLabel("Type de formation", { exact: true }),
    ).toBeVisible();
  }
  await page.getByRole("searchbox").focus();
  await page.keyboard.type("BTS");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("status")).toContainText("1 résultat");
});
