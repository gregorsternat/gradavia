import { expect, test } from "./fixtures";
import AxeBuilder from "@axe-core/playwright";

const production = process.env.E2E_PRODUCTION === "1";

test("home is accessible, responsive and free of hydration errors", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Plus de clarté",
  );
  await expect(page.getByRole("heading", { name: "Parcoursup" })).toBeVisible();
  const scan = await new AxeBuilder({ page }).analyze();
  expect(scan.violations).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("theme follows the system and preserves an explicit selection", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  await expect(page.locator("html")).toHaveClass(/dark/);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByRole("radio", { name: "Clair", exact: true }).check();
  await expect(page.locator("html")).toHaveClass(/light/);
  await page.reload();
  await expect(page.locator("html")).toHaveClass(/light/);
  await page.getByRole("radio", { name: "Système", exact: true }).check();
  await expect(page.locator("html")).toHaveClass(/dark/);
});

test("keyboard users can skip to the content and change the appearance", async ({
  page,
}) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Aller au contenu" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#contenu$/);
  await page.getByRole("radio", { name: "Clair", exact: true }).focus();
  await page.keyboard.press("Space");
  await expect(page.locator("html")).toHaveClass(/light/);
});

test("gallery is restricted to development", async ({ page }) => {
  const response = await page.goto("/dev/ui");
  if (production) {
    expect(response?.status()).toBe(404);
    await expect(
      page.getByRole("heading", { name: "Cette page n’existe pas." }),
    ).toBeVisible();
    await page.goto("/");
    await expect(
      page.getByRole("link", { name: "Galerie des composants" }),
    ).toHaveCount(0);
  } else {
    await expect(
      page.getByRole("heading", { name: "Galerie des composants" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Tester le bouton" }).click();
    await expect(page.getByRole("status")).toHaveText("Interaction vérifiée.");
    await expect(
      page.getByRole("table", { name: "Données fictives du graphique" }),
    ).toBeVisible();
    await expect(page.locator(".recharts-surface").first()).toBeVisible();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  }
});

test("reduced motion keeps the gallery usable", async ({ page }) => {
  test.skip(production, "Gallery is unavailable in production");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/dev/ui");
  const button = page.getByRole("button", { name: "Tester le bouton" });
  await button.hover();
  await page.mouse.down();
  await expect(button).toHaveCSS("transform", "none");
  await page.mouse.up();
  await button.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("status")).toHaveText("Interaction vérifiée.");
});

test("health reports app liveness without database credentials", async ({
  request,
}) => {
  const response = await request.get("/api/health");
  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({ status: "ok" });
});
