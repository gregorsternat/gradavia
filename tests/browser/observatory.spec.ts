import AxeBuilder from "@axe-core/playwright";
import { readFile } from "node:fs/promises";
import { expect, test } from "./fixtures";

test("overview renders published fixture totals with coverage and chart values", async ({
  page,
}) => {
  await page.goto("/observatoire");
  const main = page.getByRole("main");
  await expect(main).toContainText("31");
  await expect(main).toContainText("6 537");
  await expect(main).toContainText("70 967");
  await expect(main).toContainText("6 220");
  await expect(main).toContainText("2 établissements identifiés");
  await expect(main).toContainText("Somme partielle · 30 / 31 lignes");
  await expect(main).toContainText("Producteur de démonstration");
  await expect(main).toContainText("Campagne 2025 · Hors apprentissage");

  const history = page.locator("section").filter({
    has: page.getByRole("heading", {
      name: "L’offre de formation au fil des campagnes",
    }),
  });
  await history.getByRole("button", { name: "Voir les valeurs" }).click();
  const table = history.getByRole("table", {
    name: "Offre de formation par campagne",
  });
  await expect(table).toBeVisible();
  const latest = table
    .getByRole("row")
    .filter({ has: page.getByRole("cell", { name: "2025", exact: true }) });
  await expect(latest).toContainText("6 537");
  await expect(latest).toContainText("6 220");
  await expect(latest).toContainText("30 / 31");
  const earliest = table
    .getByRole("row")
    .filter({ has: page.getByRole("cell", { name: "2018", exact: true }) });
  await expect(earliest).toContainText("100");
  await expect(earliest).toContainText("95");
  await expect(table).toHaveAttribute("aria-rowcount", "9");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("campaign selection is keyboard accessible and changes the retained data", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/observatoire");
  const campaign = page.getByRole("button", { name: "Campagne d’admission" });
  await campaign.focus();
  await page.keyboard.press("ArrowDown");
  await expect(
    page.getByRole("option", { name: "2025", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("End");
  await expect(
    page.getByRole("option", { name: "2018", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/observatoire\?campagne=2018$/);
  await expect(campaign).toContainText("2018");
  await expect(page.getByRole("main")).toContainText(
    "Campagne 2018 · Hors apprentissage",
  );
  await expect(page.getByRole("main")).toContainText(
    "0 taux publiés sur 1 formations",
  );
  await campaign.click();
  await page.keyboard.press("Escape");
  await expect(campaign).toBeFocused();
  await expect(page.getByRole("listbox")).toHaveCount(0);
});

test("access distribution preserves suppressed and invalid observations outside buckets", async ({
  page,
}) => {
  await page.goto("/observatoire");
  const distribution = page.locator("section").filter({
    has: page.getByRole("heading", {
      name: "Distribution des taux d’accès",
    }),
  });
  await expect(distribution).toContainText("29 taux publiés sur 31 formations");
  await distribution.getByRole("button", { name: "Voir les valeurs" }).click();
  const table = distribution.getByRole("table", {
    name: "Répartition des taux d’accès",
  });
  for (const [bucket, count] of [
    ["0–20 %", "0"],
    ["20–40 %", "2"],
    ["40–60 %", "17"],
    ["60–80 %", "10"],
    ["80–100 %", "0"],
  ]) {
    const row = table
      .getByRole("row")
      .filter({ has: page.getByRole("cell", { name: bucket!, exact: true }) });
    await expect(row.getByRole("cell").last()).toHaveText(count!);
  }
});

test("territory search scopes the table and downloadable source data", async ({
  page,
}) => {
  await page.goto("/territoires");
  const search = page.getByRole("textbox", { name: "Rechercher une région" });
  const table = page.getByRole("table", { name: "Indicateurs par région" });
  await expect(table.getByRole("row")).toHaveCount(3);
  await search.fill("Île");
  await expect(table.getByRole("row")).toHaveCount(2);
  await expect(table).toContainText("Ile-de-France");
  await expect(table).not.toContainText("Auvergne-Rhône-Alpes");
  await expect(table.getByRole("row").last()).toContainText("160");
  await page.getByRole("radio", { name: "Candidatures", exact: true }).click();
  await expect(
    table.getByRole("columnheader", { name: "Candidatures", exact: true }),
  ).toBeVisible();
  await expect(table).toContainText("Couverture (candidatures)");
  await expect(table.getByRole("row").last()).toContainText("2 440");
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exporter", exact: true }).click();
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toBe("gradavia-territoires-2025.csv");
  const file = await download.path();
  expect(file).not.toBeNull();
  const csv = await readFile(file!, "utf8");
  expect(csv).toContain(
    '"2025";"fr-esr-parcoursup";"Ile-de-France";"2";"160";"2";"2440";"2";"150";"2"',
  );
  expect(csv).not.toContain("Auvergne-Rhône-Alpes");
  expect(csv.trim().split(/\r?\n/)).toHaveLength(2);
  await search.fill("région introuvable");
  await expect(page.getByRole("status")).toHaveText(
    "Aucune région ne correspond à cette recherche.",
  );
  await search.clear();
  await page.getByRole("radio", { name: "Places", exact: true }).click();
  await expect(table).toContainText("Couverture (places)");
  await expect(table).toContainText("28 / 29 lignes");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("source inventory distinguishes imported data and explains indicator boundaries", async ({
  page,
}) => {
  await page.goto("/sources");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Données & méthode",
  );
  await expect(
    page.getByRole("button", { name: "Import publié", exact: true }),
  ).toHaveCount(11);
  await expect(page.getByRole("main")).toContainText("Fixtures synthétiques");
  const access = page.getByRole("button", {
    name: "Taux d’accès",
    exact: true,
  });
  await access.click();
  await expect(
    page.getByRole("region", { name: "Taux d’accès", exact: true }),
  ).toContainText("ne représente pas votre probabilité personnelle");
  await page
    .getByRole("button", { name: "Pourquoi APB est séparé de Parcoursup" })
    .click();
  const apbExplanation = page.getByRole("region", {
    name: "Pourquoi APB est séparé de Parcoursup",
    exact: true,
  });
  await expect(apbExplanation).toContainText("ne trace pas de courbe continue");
  await expect(access).toHaveAttribute("aria-expanded", "false");
  // Contrast describes the readable resting state, after the opening fade.
  await expect(apbExplanation.locator(":scope > div")).toHaveCSS(
    "opacity",
    "1",
  );
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
