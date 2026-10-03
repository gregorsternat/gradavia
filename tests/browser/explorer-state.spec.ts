import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "./fixtures";

test("empty, unconfigured and unavailable API states support retry", async ({
  page,
}) => {
  await page.goto("/formations?campagne=2018&q=droit");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Explorer les formations",
  );
  const message =
    process.env.E2E_STATE === "empty"
      ? "Aucune campagne n’est disponible pour le moment."
      : "Les formations sont temporairement indisponibles.";
  await expect(page.getByRole("heading", { level: 2 })).toHaveText(message);
  await expect(page.getByRole("article")).toHaveCount(0);
  await page.getByRole("link", { name: "Réessayer" }).click();
  await expect(page).toHaveURL(/campagne=2018&q=droit$/);
  if (process.env.E2E_STATE === "unavailable")
    await expect(page.getByRole("status")).toHaveText(
      "Chargement des formations…",
    );
  // The client permits 18 seconds for a bounded upstream read, including retry.
  await expect(page.getByRole("heading", { level: 2 })).toHaveText(message, {
    timeout: 20_000,
  });
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
