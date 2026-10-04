import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "./fixtures";

test("inverse specialty search preserves the national scope, suppression and reproducible indicator", async ({
  page,
}) => {
  await page.goto("/specialites/inverse");
  const picker = page.getByRole("combobox", {
    name: "Libellé national de formation",
  });
  await expect(picker).toBeEnabled();
  await picker.fill("Informatique");
  await page
    .getByRole("option", { name: "BUT - Informatique · BUT", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "BUT - Informatique", exact: true }),
  ).toBeVisible();
  const table = page.getByRole("table", {
    name: "Combinaisons par formation nationale",
  });
  await expect(table).toContainText("Masqué");
  await expect(table).toContainText("150");
  await expect(page.getByRole("main")).toContainText("Périmètre national");
  await page
    .getByRole("button", { name: "Indicateur des spécialités" })
    .click();
  await page
    .getByRole("option", { name: "Vœux confirmés", exact: true })
    .click();
  await expect(page).toHaveURL(/tri=applications/);
  const firstFormation = page.url();
  await picker.fill("Chimie");
  await page
    .getByRole("option", { name: "BUT - Chimie · BUT", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "BUT - Chimie", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Indicateur des spécialités", exact: true })
    .click();
  await page
    .getByRole("option", { name: "Avec une acceptation", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Indicateur des spécialités",
      exact: true,
    }),
  ).toContainText("Avec une acceptation");
  expect(new URL(page.url()).searchParams.has("tri")).toBe(false);
  await page.goBack();
  await expect(page).toHaveURL(firstFormation);
  await expect(
    page.getByRole("heading", { name: "BUT - Informatique", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Indicateur des spécialités",
      exact: true,
    }),
  ).toContainText("Vœux confirmés");
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Indicateur des spécialités" }),
  ).toContainText("Vœux confirmés");
  await expect(page.locator(".recharts-wrapper svg").first()).toBeVisible();
  await page
    .getByRole("button", { name: "Source et périmètre · Spécialités 2025" })
    .click();
  await expect(page.getByRole("main")).toContainText(
    "ne décrivent pas le recrutement d’un établissement ou d’un campus",
  );
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exporter", exact: true }).click();
  expect((await downloadEvent).suggestedFilename()).toBe(
    "gradavia-specialites-par-formation.csv",
  );
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

const pairLabel = "Mathématiques + Physique-Chimie";
const secondLabel = "Mathématiques + Sciences économiques et sociales";

test("specialty search waits for hydration before accepting text", async ({
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
    await page.goto("/specialites", { waitUntil: "commit" });
    const input = page.getByRole("combobox", {
      name: "Combinaison de spécialités",
    });
    await expect(input).toBeDisabled();
    hydrate();
    await expect(input).toBeEnabled();
    await input.fill("economiques");
    await expect(input).toHaveValue("economiques");
    await expect(page.getByRole("option", { name: secondLabel })).toBeVisible();
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await expect(input).toHaveValue(secondLabel);
  } finally {
    hydrate();
  }
});

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
    "gradavia-specialites-2025.csv",
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
