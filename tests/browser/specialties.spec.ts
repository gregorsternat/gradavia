import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "./fixtures";

const pairLabel = "Mathématiques + Physique-Chimie";
const secondLabel = "Mathématiques + Sciences économiques et sociales";

test("specialties keep national counts separate from overlapping groups and provide accessible charts", async ({
  page,
}) => {
  await page.goto("/specialites");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Spécialités du bac",
  );
  await expect(
    page.getByRole("combobox", { name: "Combinaison de spécialités" }),
  ).toHaveValue(pairLabel);
  const national = page
    .getByRole("heading", { name: "Vœux confirmés", exact: true })
    .locator("../..");
  await expect(national).toContainText(/1\s?000/);
  await expect(
    page.getByRole("table", { name: "Groupes par combinaison de spécialités" }),
  ).toBeVisible();
  const main = page.getByRole("main");
  await expect(main).toHaveCount(1);
  const overlapNotice = main.getByText(
    "Un candidat peut figurer dans plusieurs groupes. Ces effectifs ne s’additionnent pas.",
  );
  await expect(overlapNotice).toHaveCount(1);
  await expect(overlapNotice).toBeVisible();
  await expect(main.locator(".recharts-surface")).toHaveCount(1);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("link", { name: "CPGE", exact: true }).click();
  await expect(page).toHaveURL(/groupe=CPGE/);
  await expect(
    page.getByRole("table", {
      name: "Formations par combinaison de spécialités",
    }),
  ).toContainText("MPSI");
  await expect(national).toContainText(/1\s?000/);
});

test("searchable specialty pair selection works with accents and keyboard and survives reload", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/specialites");
  const input = page.getByRole("combobox", {
    name: "Combinaison de spécialités",
  });
  await input.fill("economiques");
  await expect(page.getByRole("option", { name: secondLabel })).toBeVisible();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(input).toHaveValue(secondLabel);
  await expect(
    page
      .getByRole("heading", { name: "Vœux confirmés", exact: true })
      .locator("../.."),
  ).toContainText("800");
  const shared = page.url();
  await page.reload();
  await expect(input).toHaveValue(secondLabel);
  await expect(page).toHaveURL(shared);
  await input.click();
  await page.keyboard.press("Escape");
  await expect(input).toBeFocused();
});

test("specialty drill-down preserves masked and observed zero and exports labelled data", async ({
  page,
}) => {
  await page.goto("/specialites");
  await page.getByRole("link", { name: "BUT", exact: true }).click();
  await page
    .getByRole("button", { name: "Indicateur des spécialités", exact: true })
    .click();
  await page
    .getByRole("option", { name: "Avec une acceptation", exact: true })
    .click();
  await expect(page).toHaveURL(/groupe=BUT.*tri=accepted/);
  const table = page.getByRole("table", {
    name: "Formations par combinaison de spécialités",
  });
  await expect(
    table.getByRole("row").filter({ hasText: "BUT - Informatique" }),
  ).toContainText("Masqué");
  await expect(
    table.getByRole("row").filter({ hasText: "BUT - Chimie" }),
  ).toContainText("0");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exporter", exact: true }).click();
  expect((await download).suggestedFilename()).toBe(
    "orvio-specialites-2025.csv",
  );
  await page
    .getByRole("button", {
      name: "Définitions et précautions de lecture",
      exact: true,
    })
    .click();
  await expect(page.getByText(/Champ source : acceptations/)).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByRole("link", { name: "Tous les groupes" }).click();
  await expect(
    page.getByRole("table", { name: "Groupes par combinaison de spécialités" }),
  ).toBeVisible();
});
