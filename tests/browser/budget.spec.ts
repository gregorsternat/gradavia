import { test, expect } from "./fixtures";

test("budget totals follow entered assumptions and survive explicit saving", async ({
  page,
}) => {
  await page.goto("/budget");
  const first = page.getByRole("region", { name: "Scénario 1", exact: true });
  await expect(first.getByText("À compléter", { exact: true })).toBeVisible();
  await first.getByRole("textbox", { name: "Ville", exact: true }).fill("Lyon");
  for (const [label, value] of [
    ["Logement / mois (€)", "500"],
    ["Alimentation / mois (€)", "200"],
    ["Transport / mois (€)", "30"],
    ["Autres dépenses / mois (€)", "0"],
    ["Frais de formation / an (€)", "100"],
    ["Installation, une seule fois (€)", "500"],
  ]) {
    await first.getByRole("textbox", { name: label, exact: true }).fill(value!);
  }
  await expect(first.getByText(/27\s?080\s?€/)).toBeVisible();
  await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText(
    "Scénarios enregistrés sur cet appareil.",
  );
  await page.reload();
  await expect(
    first.getByRole("textbox", { name: "Ville", exact: true }),
  ).toHaveValue("Lyon");
  await expect(first.getByText(/27\s?080\s?€/)).toBeVisible();
  await expect(page.locator("body")).toHaveJSProperty(
    "scrollWidth",
    await page.locator("body").evaluate((element) => element.clientWidth),
  );
});
