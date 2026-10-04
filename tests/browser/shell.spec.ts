import { expect, test } from "./fixtures";
import AxeBuilder from "@axe-core/playwright";

const production = process.env.E2E_PRODUCTION === "1";

async function openNavigation(
  page: import("@playwright/test").Page,
  mobile: boolean,
) {
  if (mobile)
    await page
      .getByRole("button", { name: "Afficher ou masquer la navigation" })
      .click();
}

test("overview is accessible, responsive and free of hydration errors", async ({
  page,
}) => {
  await page.goto("/observatoire");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Vue d’ensemble",
  );
  await expect(
    page.getByRole("heading", { name: "Les familles de formation" }),
  ).toBeVisible();
  await expect(page.locator(".recharts-surface")).toHaveCount(4);
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
  isMobile,
}) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/observatoire");
  await expect(page.locator("html")).toHaveClass(/dark/);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await openNavigation(page, isMobile);
  await page.getByRole("radio", { name: "Clair", exact: true }).click();
  await expect(page.locator("html")).toHaveClass(/light/);
  await page.reload();
  await expect(page.locator("html")).toHaveClass(/light/);
  await openNavigation(page, isMobile);
  await page.getByRole("radio", { name: "Système", exact: true }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
});

test("keyboard users can skip to the content and change the appearance", async ({
  page,
  isMobile,
}) => {
  await page.goto("/observatoire");
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Aller au contenu" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#contenu$/);
  await expect(page.locator("#contenu")).toBeFocused();
  await openNavigation(page, isMobile);
  await page.getByRole("radio", { name: "Système", exact: true }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(
    page.getByRole("radio", { name: "Clair", exact: true }),
  ).toBeFocused();
  await expect(page.locator("html")).toHaveClass(/light/);
  await page.keyboard.press("End");
  await expect(
    page.getByRole("radio", { name: "Sombre", exact: true }),
  ).toBeChecked();
  await expect(page.locator("html")).toHaveClass(/dark/);
});

test("command palette searches pages and restores keyboard focus", async ({
  page,
}) => {
  await page.goto("/observatoire");
  // The server-rendered navigation can appear before keyboard handlers attach.
  await expect(page.locator(".recharts-surface")).toHaveCount(4);
  const opener = page.getByRole("button", {
    name: "Afficher ou masquer la navigation",
  });
  await opener.focus();
  await page.keyboard.press("Control+k");
  const dialog = page.getByRole("dialog", { name: "Recherche rapide" });
  const input = dialog.getByRole("combobox");
  await expect(input).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(input).toBeFocused();
  await expect(dialog).toHaveCSS("opacity", "1");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(opener).toBeFocused();
  await page.keyboard.press("Control+k");
  await input.fill("territoires");
  await expect(dialog.getByRole("option")).toHaveCount(1);
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/territoires$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Territoires",
  );
  await page.keyboard.press("Control+k");
  await dialog.getByRole("combobox").fill("observatoire");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/observatoire$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Vue d’ensemble",
  );
});

test("navigation waits for hydration before accepting its first activation", async ({
  page,
  isMobile,
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
    await page.goto("/observatoire", { waitUntil: "commit" });
    const trigger = page.getByRole("button", {
      name: "Afficher ou masquer la navigation",
    });
    await expect(trigger).toBeDisabled();
    hydrate();
    await expect(trigger).toBeEnabled();
    await trigger.click();
    if (isMobile) {
      await expect(
        page.getByRole("dialog", { name: "Navigation principale" }),
      ).toBeVisible();
    } else {
      await expect(trigger).toHaveAttribute("aria-expanded", "false");
    }
  } finally {
    hydrate();
  }
});

test("navigation collapses on desktop and behaves as a modal on mobile", async ({
  page,
  isMobile,
}) => {
  await page.goto("/observatoire");
  const trigger = page.getByRole("button", {
    name: "Afficher ou masquer la navigation",
  });
  await trigger.click();
  if (isMobile) {
    const navigation = page.getByRole("dialog", {
      name: "Navigation principale",
    });
    await expect(navigation).toBeVisible();
    const system = navigation.getByRole("radio", {
      name: "Système",
      exact: true,
    });
    const home = navigation.getByRole("link", { name: "Gradavia, accueil" });
    await system.click();
    await system.focus();
    await page.keyboard.press("Tab");
    await expect(home).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(system).toBeFocused();
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    await expect(
      navigation.getByRole("button", { name: "Fermer la navigation" }),
    ).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(navigation).toBeHidden();
    await expect(trigger).toBeFocused();
    await trigger.click();
    await navigation
      .getByRole("link", { name: "Formations", exact: true })
      .focus();
    await page.keyboard.press("Escape");
    await expect(navigation).toBeHidden();
    await expect(trigger).toBeFocused();
    await trigger.click();
    await navigation
      .getByRole("button", { name: "Ouvrir la recherche rapide" })
      .click();
    await expect(navigation).toBeHidden();
    await expect(
      page.getByRole("dialog", { name: "Recherche rapide" }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await trigger.click();
    await navigation
      .getByRole("link", { name: "Formations", exact: true })
      .focus();
    await page.keyboard.press("Control+k");
    await expect(navigation).toBeHidden();
    await expect(
      page
        .getByRole("dialog", { name: "Recherche rapide" })
        .getByRole("combobox"),
    ).toBeFocused();
    await expect(page.getByRole("dialog")).toHaveCount(1);
    await page.keyboard.press("Escape");
    await expect(trigger).toBeFocused();
  } else {
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    await expect(
      page
        .getByRole("navigation", { name: "Explorer Gradavia" })
        .getByRole("link", { name: "Formations", exact: true }),
    ).toBeVisible();
    await trigger.click();
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
  }
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
