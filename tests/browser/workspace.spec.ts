import { expect, test } from "./fixtures";

test("project tabs preserve drafts, use native history and avoid repeated reads", async ({
  page,
}) => {
  await page.goto("/favoris");
  const requests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/workspace/")) requests.push(request.url());
  });
  await page.getByRole("tab", { name: "Budget", exact: true }).click();
  await expect(page).toHaveURL(/\/favoris\?onglet=budget$/);
  await expect(
    page.getByRole("heading", { name: /budget/i }).first(),
  ).toBeVisible();
  const fields = page.locator('[role="tabpanel"]:visible input');
  const field = fields.first();
  await field.fill("Mon scénario conservé");
  const count = requests.length;
  await page.getByRole("tab", { name: "Favoris", exact: true }).click();
  await page.getByRole("tab", { name: "Budget", exact: true }).click();
  await expect(field).toHaveValue("Mon scénario conservé");
  expect(requests.length).toBe(count);
  await page.goBack();
  await expect(
    page.getByRole("tab", { name: "Favoris", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await page.goForward();
  await expect(field).toHaveValue("Mon scénario conservé");
  expect(await page.locator("main#contenu").count()).toBe(1);
});

test("keyboard focus does not load an unactivated tab", async ({ page }) => {
  await page.goto("/favoris");
  const tab = page.getByRole("tab", { name: "Favoris", exact: true });
  await expect(tab).not.toHaveAttribute("aria-disabled", "true");
  await tab.focus();
  await page.keyboard.press("ArrowRight");
  await expect(
    page.getByRole("tab", { name: "Budget", exact: true }),
  ).toBeFocused();
  await expect(tab).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/onglet=budget/);
});

test("legacy tools redirect to their rendered, shareable panel", async ({
  page,
  request,
}) => {
  const response = await request.get("/budget", { maxRedirects: 0 });
  expect(response.status()).toBe(308);
  expect(response.headers().location).toBe("/favoris?onglet=budget");
  await page.goto("/budget");
  await expect(
    page.getByRole("tab", { name: "Budget", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await page.reload();
  await expect(
    page.getByRole("tab", { name: "Budget", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
});

test("a failed first panel load leaves other tabs usable and can be retried", async ({
  page,
}) => {
  await page.goto("/favoris");
  await page.route("**/api/workspace/budget*", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: "invalid json",
    }),
  );
  await page.getByRole("tab", { name: "Budget", exact: true }).click();
  await expect(page.locator("main").getByRole("alert")).toContainText(
    "temporairement indisponibles",
  );
  await page.getByRole("tab", { name: "Favoris", exact: true }).click();
  await expect(
    page.getByRole("tab", { name: "Favoris", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await page.unroute("**/api/workspace/budget*");
  await page.getByRole("tab", { name: "Budget", exact: true }).click();
  await page.getByRole("button", { name: "Réessayer", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: /budget/i }).first(),
  ).toBeVisible();
});
