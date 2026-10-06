import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "./fixtures";

test("landing stays useful without published data and does not invent numerical previews", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Votre orientation,",
  );
  const fallback = page.getByRole("region", { name: "Explorer Parcoursup" });
  await expect(fallback).toBeVisible();
  await expect(fallback).not.toContainText(/\d/);
  await expect(
    page.getByRole("region", { name: "Aperçu de l’observatoire" }),
  ).toHaveCount(0);
  await expect(page.locator(".recharts-surface")).toHaveCount(0);
  await expect(
    fallback.getByRole("link", { name: "Vue d’ensemble" }),
  ).toHaveAttribute("href", "/observatoire");
  await expect(
    page.getByRole("link", { name: "Lire la méthode" }),
  ).toHaveAttribute("href", "/sources");
  const search = page.getByRole("search", { name: "Trouver une formation" });
  await search.getByRole("searchbox").fill("Droit");
  await expect(
    search.getByRole("button", { name: "Rechercher", exact: true }),
  ).toBeEnabled();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

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
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    "noindex, follow",
  );
  await page.getByRole("link", { name: "Réessayer" }).click();
  await expect(page).toHaveURL(/campagne=2018&q=droit$/);
  // The client permits 18 seconds for a bounded upstream read, including retry.
  await expect(page.getByRole("heading", { level: 2 })).toHaveText(message, {
    timeout: 20_000,
  });
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("source failure does not publish a successful empty discovery sitemap", async ({
  request,
}) => {
  const response = await request.get("/sitemap-formations.xml");
  if (process.env.E2E_STATE === "empty") {
    expect(response.status()).toBe(200);
    expect(await response.text()).not.toContain("<loc>");
  } else {
    expect(response.status()).toBe(503);
    expect(response.headers()["retry-after"]).toBe("300");
    expect(response.headers()["cache-control"]).toBe("no-store");
  }
  expect((await request.get("/sitemap.xml")).status()).toBe(200);
});
