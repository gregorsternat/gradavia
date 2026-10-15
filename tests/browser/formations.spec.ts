import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";

async function selectOption(page: Page, label: string, option: string) {
  await page.getByRole("button", { name: label, exact: true }).click();
  await page.getByRole("option", { name: option, exact: true }).click();
}
async function openFilters(page: Page) {
  await page.getByRole("button", { name: /^Filtres/ }).click();
  await expect(
    page.getByRole("button", { name: "Type de formation", exact: true }),
  ).toBeVisible();
}

test("copy feedback handles navigation, keyboard activation and stale writes", async ({
  page,
  context,
}, testInfo) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/formations");
  const copy = page.getByRole("button", { name: /^(Partager|Lien copié)$/ });
  await expect(copy).toBeEnabled();
  await copy.focus();
  await page.keyboard.press("Enter");
  await expect(copy).toHaveText("Lien copié");
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toBe(page.url());

  await page.getByRole("searchbox").fill("Systèmes");
  await page.getByRole("button", { name: "Rechercher", exact: true }).click();
  await expect(page).toHaveURL(/q=Syst/);
  await page.evaluate(() => {
    window.location.hash = "contenu";
  });
  await copy.focus();
  await page.keyboard.press("Space");
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toBe(page.url());

  await page.evaluate(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async () => {
          throw new DOMException("Clipboard denied", "NotAllowedError");
        },
      },
    });
  });
  await copy.click();
  await expect(copy).toHaveText("Partager");
  const fallback = page.getByRole("status").filter({
    hasText: "Copiez l’adresse de cette page depuis votre navigateur.",
  });
  await expect(fallback).toBeVisible();

  await page.evaluate(() => {
    let calls = 0;
    let resolveFirstWrite: (() => void) | undefined;
    const testWindow = window as Window & {
      resolveFirstClipboardWrite?: () => void;
    };
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async () => {
          calls += 1;
          if (calls === 1)
            await new Promise<void>((resolve) => {
              resolveFirstWrite = resolve;
            });
          else throw new DOMException("Clipboard denied", "NotAllowedError");
        },
      },
    });
    testWindow.resolveFirstClipboardWrite = () => resolveFirstWrite?.();
  });
  await copy.click();
  await copy.click();
  await expect(fallback).toBeVisible();
  await page.evaluate(() => {
    (
      window as Window & { resolveFirstClipboardWrite?: () => void }
    ).resolveFirstClipboardWrite?.();
  });
  await expect(fallback).toBeVisible();

  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("copy-error.png") });
});

test("explorer is accessible with focused results and bounded list and card views", async ({
  page,
  isMobile,
}) => {
  await page.goto("/formations");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Explorer les formations",
  );
  await expect(
    page.getByRole("button", { name: "Campagne d’admission" }),
  ).toContainText("2025");
  await expect(page.getByRole("status")).toContainText("31 résultats");
  if (isMobile) {
    await expect(page.getByRole("article")).toHaveCount(25);
    await page.getByRole("tab", { name: "Vue liste" }).click();
  }
  await expect(
    page.getByRole("table", { name: "Résultats de la recherche" }),
  ).toHaveAttribute("aria-rowcount", "32");
  await expect(
    page.getByRole("button", { name: /Source et périmètre/ }),
  ).toHaveCount(0);
  await expect(
    page.getByText(/Toutes les formations de cette page/),
  ).toHaveCount(0);
  await expect(page.getByText(/Les critères communs suivent/)).toHaveCount(0);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("tab", { name: "Vue cartes" }).click();
  await expect
    .poll(() => page.getByRole("article").count())
    .toBeGreaterThanOrEqual(25);
  expect(await page.getByRole("article").count()).toBeLessThanOrEqual(31);
  await expect(page).toHaveURL(/vue=cartes/);
  if (isMobile)
    await page
      .getByRole("button", { name: "Afficher ou masquer la navigation" })
      .click();
  await page.getByRole("radio", { name: "Sombre", exact: true }).click();
  if (isMobile) await page.keyboard.press("Escape");
  else
    await expect(
      page.getByRole("tooltip", { name: "Sombre", exact: true }),
    ).toBeVisible();
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

test("pending searches and sorting retain criteria when the view is changed immediately", async ({
  page,
}) => {
  await page.goto("/formations?vue=liste");
  await expect(page.getByRole("status")).toContainText("31 résultats");
  let releaseSearch!: () => void;
  let releaseSort!: () => void;
  const searchGate = new Promise<void>((resolve) => {
    releaseSearch = resolve;
  });
  const sortGate = new Promise<void>((resolve) => {
    releaseSort = resolve;
  });
  await page.route("**/api/workspace/formations?**", async (route) => {
    const params = new URL(route.request().url()).searchParams;
    if (params.get("q") === "ecole etampes")
      await (params.get("tri") === "capacite" ? sortGate : searchGate);
    await route.continue();
  });
  try {
    await page.getByRole("searchbox").fill("ecole etampes");
    await page.getByRole("button", { name: "Rechercher", exact: true }).click();
    await expect(page.locator("#formations-contenu")).toHaveAttribute(
      "aria-busy",
      "true",
    );
    await expect(page.getByRole("tab", { name: "Vue cartes" })).toBeDisabled();
    await expect(
      page.getByRole("button", { name: "Trier les formations" }),
    ).toBeDisabled();
    const changeToCards = page.getByRole("tab", { name: "Vue cartes" }).click();
    releaseSearch();
    await changeToCards;
    await expect(page.getByRole("status")).toContainText("2 résultats");
    await expect(page.getByRole("article")).toHaveCount(2);
    expect(new URL(page.url()).searchParams.get("q")).toBe("ecole etampes");

    await selectOption(page, "Trier les formations", "Places · Décroissant");
    await expect(page.locator("#formations-contenu")).toHaveAttribute(
      "aria-busy",
      "true",
    );
    await expect(page.getByRole("tab", { name: "Vue liste" })).toBeDisabled();
    const changeToList = page.getByRole("tab", { name: "Vue liste" }).click();
    releaseSort();
    await changeToList;
    const params = new URL(page.url()).searchParams;
    expect(params.get("q")).toBe("ecole etampes");
    expect(params.get("tri")).toBe("capacite");
    expect(params.get("vue")).toBe("liste");
    await expect(
      page.getByRole("table", { name: "Résultats de la recherche" }),
    ).toHaveAttribute("aria-rowcount", "3");
  } finally {
    releaseSearch();
    releaseSort();
  }
});

test("filters combine, async cards accumulate and new searches reset the rows", async ({
  page,
}) => {
  await page.goto("/formations?vue=cartes");
  await expect(page.getByRole("searchbox")).toBeEditable();
  await page.locator("[data-load-progress]:visible").scrollIntoViewIfNeeded();
  await expect(page.getByRole("article")).toHaveCount(31);
  await expect(page.locator("[data-load-progress]:visible")).toContainText(
    "31 résultats affichés sur 31",
  );
  expect(new URL(page.url()).searchParams.has("page")).toBe(false);
  await openFilters(page);
  await selectOption(page, "Type de formation", "Licence");
  await selectOption(page, "Région", "Ile-de-France");
  await selectOption(page, "Département", "Essonne");
  await page.getByRole("button", { name: "Appliquer les filtres" }).click();
  await expect(page.getByRole("status")).toContainText("2 résultats");
  expect(new URL(page.url()).searchParams.has("page")).toBe(false);
  await expect(page.getByRole("article")).toHaveCount(2);
  await selectOption(page, "Trier les formations", "Places · Décroissant");
  await expect(page).toHaveURL(/tri=capacite/);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Trier les formations" }),
  ).toContainText("Places · Décroissant");
});

test("campaign changes reset the search and explain historical gaps", async ({
  page,
}) => {
  await page.goto(
    "/formations?campagne=2025&q=droit&type=Licence&page=2&vue=cartes",
  );
  await selectOption(page, "Campagne d’admission", "Campagne 2018");
  await expect(page).toHaveURL(/\/formations\?campagne=2018&vue=cartes$/);
  await expect(page.getByRole("searchbox")).toHaveValue("");
  await openFilters(page);
  await expect(
    page.getByRole("button", {
      name: "Statut de l’établissement",
      exact: true,
    }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Sélectivité", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByText("Ville non renseignée", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Licence - Droit — Droit — Parcours européen",
    }),
  ).toBeVisible();
  await expect(page).toHaveTitle(/Parcoursup 2018/);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    "https://gradavia.com/formations?campagne=2018",
  );
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("keyboard and reduced motion preserve search and filter access", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/formations");
  await expect(page.getByRole("status")).toContainText("31 résultats");
  // Exercise client keyboard navigation after hydration; SSR links have their own journey.
  await expect(page.getByRole("button", { name: /^Filtres/ })).toBeEnabled();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Aller au contenu" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("main#contenu")).toBeFocused();
  await expect(page.getByRole("button", { name: /^Filtres/ })).toBeEnabled();
  await page.getByRole("button", { name: /^Filtres/ }).focus();
  await page.keyboard.press("Enter");
  const filter = page.getByRole("button", {
    name: "Type de formation",
    exact: true,
  });
  await expect(filter).toBeVisible();
  await filter.focus();
  await page.keyboard.press("ArrowDown");
  await expect(
    page.getByRole("option", { name: "Tous", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("End");
  await page.keyboard.press("Escape");
  await expect(filter).toBeFocused();
  await page.getByRole("searchbox").focus();
  await page.keyboard.type("BTS");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("status")).toContainText("1 résultat");
});

test("formation details preserve zero and masked values with history and focused tabs @smoke", async ({
  page,
}) => {
  await page.goto("/formations?q=Droit+02&vue=cartes");
  await page.getByRole("link", { name: "Voir la formation" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Licence - Droit 02",
  );
  await expect(
    page.getByRole("heading", { name: "Admis", exact: true }).locator("../.."),
  ).toContainText("0");
  await expect(page.locator(".recharts-surface:visible")).toHaveCount(2);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByRole("tab", { name: "Historique", exact: true }).click();
  await expect(
    page.getByRole("table", {
      name: "Historique des indicateurs et continuité",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("tab", { name: "Définitions et source" }),
  ).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Définition/ })).toHaveCount(0);
  await page.goto("/formations?q=Droit+03&vue=cartes");
  await page.getByRole("link", { name: "Voir la formation" }).click();
  await expect(
    page
      .getByRole("heading", { name: "Taux d’accès", exact: true })
      .locator("../.."),
  ).toContainText("Masqué");
});

test("favorites persist through reload and can be removed from the saved page @smoke", async ({
  page,
}) => {
  await page.goto("/formations?q=Droit+01&vue=cartes");
  await page
    .getByRole("button", {
      name: "Ajouter aux favoris : Licence - Droit 01",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Retirer des favoris : Licence - Droit 01",
      exact: true,
    }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.goto("/favoris");
  await expect(
    page.getByRole("heading", { name: "Licence - Droit 01", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Licence - Droit 01", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: "Retirer des favoris : Licence - Droit 01",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Aucune formation enregistrée",
    }),
  ).toBeVisible();
});

test("selections saved before the rename survive and new empty selections take precedence", async ({
  page,
}) => {
  await page.goto("/formations?q=Droit+01&vue=cartes");
  const href = await page
    .getByRole("link", { name: "Licence - Droit 01", exact: true })
    .getAttribute("href");
  const formation = {
    id: decodeURIComponent(href!.split("/").at(-1)!),
    campaign: 2025,
    title: "Licence - Droit 01",
    establishment: null,
  };
  await page.evaluate((row) => {
    localStorage.setItem(
      "orvio.selection.v1",
      JSON.stringify({ favorites: [row], comparison: [row] }),
    );
  }, formation);
  await page.goto("/favoris");
  await expect(
    page.getByRole("heading", { name: formation.title, exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: `Retirer des favoris : ${formation.title}`,
      exact: true,
    })
    .click();
  await page.reload();
  await expect(
    page.getByRole("heading", {
      name: "Aucune formation enregistrée",
    }),
  ).toBeVisible();
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem("gradavia.selection.v1")!),
    ),
  ).toEqual({ favorites: [], comparison: [formation] });
  await page.goto("/comparer");
  await expect(
    page.getByRole("link", { name: formation.title, exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: `Retirer ${formation.title} de la comparaison`,
      exact: true,
    })
    .click();
  await page.goto("/comparer");
  await expect(
    page.getByRole("heading", {
      name: "Quelles formations vous intéressent ?",
      exact: true,
    }),
  ).toBeVisible();
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem("gradavia.selection.v1")!),
    ),
  ).toEqual({ favorites: [], comparison: [] });
});

test("comparison is shareable, exports its values and blocks mixed campaign selection @smoke", async ({
  page,
}) => {
  await page.goto("/formations?q=Droit&vue=cartes");
  await page
    .getByRole("button", { name: "Comparer : Licence - Droit 01", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Comparer : Licence - Droit 02", exact: true })
    .click();
  await page.getByRole("link", { name: "Comparer", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Comparer les formations",
  );
  await expect(
    page.getByRole("table", { name: "Comparaison des indicateurs" }),
  ).toBeVisible();
  expect(new URL(page.url()).searchParams.get("ids")?.split(",")).toHaveLength(
    2,
  );
  const shared = page.url();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exporter la comparaison" }).click();
  expect((await download).suggestedFilename()).toBe("gradavia-comparaison.csv");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.reload();
  await expect(page).toHaveURL(shared);
  await expect(
    page.getByRole("link", { name: "Licence - Droit 02", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: "Retirer du comparateur : Licence - Droit 02",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("link", { name: "Licence - Droit 02", exact: true }),
  ).toHaveCount(0);
  expect(new URL(page.url()).searchParams.get("ids")?.split(",")).toHaveLength(
    1,
  );
  await page.goto("/formations?q=Droit+02&vue=cartes");
  await expect(
    page.getByRole("button", {
      name: "Comparer : Licence - Droit 02",
      exact: true,
    }),
  ).toHaveAttribute("aria-pressed", "false");
  await page.goto("/formations?campagne=2024&vue=cartes");
  await page
    .getByRole("button", { name: "Comparer : Licence - Droit", exact: true })
    .click();
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "La sélection concerne la campagne 2025" }),
  ).toBeVisible();
});

test("shared comparison controls remove displayed URL selections without local state", async ({
  page,
}) => {
  await page.goto("/formations?q=Droit&vue=cartes");
  const ids = await Promise.all(
    ["Licence - Droit 01", "Licence - Droit 02"].map(async (title) => {
      const path = await page
        .getByRole("link", { name: title, exact: true })
        .getAttribute("href");
      return decodeURIComponent(path!.split("/").at(-1)!);
    }),
  );
  await page.goto(`/comparer?${new URLSearchParams({ ids: ids.join(",") })}`);
  const remove = page.getByRole("button", {
    name: "Retirer du comparateur : Licence - Droit 01",
    exact: true,
  });
  await expect(remove).toHaveAttribute("aria-pressed", "true");
  await remove.click();
  await expect(
    page.getByRole("link", { name: "Licence - Droit 01", exact: true }),
  ).toHaveCount(0);
  expect(new URL(page.url()).searchParams.get("ids")).toBe(ids[1]);
  await page
    .getByRole("button", {
      name: "Retirer Licence - Droit 02 de la comparaison",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Quelles formations vous intéressent ?",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page).toHaveURL(/comparer\?ids=$/);
});

test("adding to a shared comparison preserves its formations and campaign with fresh storage", async ({
  page,
}) => {
  const titles = [
    "Licence - Droit 01",
    "Licence - Droit 02",
    "Licence - Droit 03",
  ];
  await page.goto("/formations?campagne=2025&q=Droit&vue=cartes");
  const ids = await Promise.all(
    titles.map(async (title) => {
      const path = await page
        .getByRole("link", { name: title, exact: true })
        .getAttribute("href");
      return decodeURIComponent(path!.split("/").at(-1)!);
    }),
  );
  expect(
    await page.evaluate(() => localStorage.getItem("gradavia.selection.v1")),
  ).toBeNull();
  await page.goto(
    `/comparer?${new URLSearchParams({ ids: ids.slice(0, 2).join(",") })}`,
  );
  await page.getByRole("button", { name: "Ajouter une formation" }).click();
  await expect(page).toHaveURL(/\/formations\?campagne=2025$/);
  await expect(
    page.getByRole("button", { name: "Campagne d’admission" }),
  ).toContainText("2025");
  await page.getByRole("searchbox").fill("Droit 03");
  await page.getByRole("button", { name: "Rechercher", exact: true }).click();
  await page
    .getByRole("button", { name: `Comparer : ${titles[2]}`, exact: true })
    .click();
  await page.getByRole("link", { name: "Comparer", exact: true }).click();
  for (const title of titles)
    await expect(
      page.getByRole("link", { name: title, exact: true }),
    ).toBeVisible();
  expect(new URL(page.url()).searchParams.get("ids")?.split(",")).toEqual(ids);
  await page.reload();
  await expect(
    page.getByRole("table", { name: "Comparaison des indicateurs" }),
  ).toBeVisible();
  expect(new URL(page.url()).searchParams.get("ids")?.split(",")).toEqual(ids);
  let releaseFirst!: () => void;
  const firstResponse = new Promise<void>((resolve) => {
    releaseFirst = resolve;
  });
  let requestCount = 0;
  await page.route("**/api/workspace/selection?*", async (route) => {
    const first = requestCount++ === 0;
    const response = await route.fetch();
    if (first) await firstResponse;
    await route.fulfill({ response });
  });
  try {
    const firstRequest = page.waitForRequest("**/api/workspace/selection?*");
    await page
      .getByRole("button", {
        name: `Retirer du comparateur : ${titles[0]}`,
        exact: true,
      })
      .click();
    await firstRequest;
    await expect(
      page.getByRole("link", { name: titles[0], exact: true }),
    ).toHaveCount(0);
    const secondResponse = page.waitForResponse("**/api/workspace/selection?*");
    await page
      .getByRole("button", {
        name: `Retirer du comparateur : ${titles[1]}`,
        exact: true,
      })
      .click();
    await secondResponse;
    for (const title of titles.slice(0, 2))
      await expect(
        page.getByRole("link", { name: title, exact: true }),
      ).toHaveCount(0);
    expect(new URL(page.url()).searchParams.get("ids")?.split(",")).toEqual([
      ids[2],
    ]);
    const staleResponse = page.waitForResponse("**/api/workspace/selection?*");
    releaseFirst();
    await staleResponse;
    for (const title of titles.slice(0, 2))
      await expect(
        page.getByRole("link", { name: title, exact: true }),
      ).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: titles[2], exact: true }),
    ).toBeVisible();
    expect(new URL(page.url()).searchParams.get("ids")?.split(",")).toEqual([
      ids[2],
    ]);
  } finally {
    releaseFirst();
    await page.unrouteAll({ behavior: "wait" });
  }
});

test("async table keeps rows on failure, retries once and shares accumulated cards", async ({
  page,
}) => {
  let calls = 0;
  await page.route("**/api/workspace/formations?**", async (route) => {
    if (new URL(route.request().url()).searchParams.get("page") !== "2")
      return route.continue();
    calls++;
    if (calls === 1)
      return route.fulfill({
        json: { kind: "formations", result: { status: "unavailable" } },
      });
    return route.continue();
  });
  await page.goto("/formations?vue=liste");
  await expect(page.getByRole("searchbox")).toBeEditable();
  const table = page.getByRole("table", { name: "Résultats de la recherche" });
  const region = page.getByRole("region", {
    name: "Résultats de la recherche",
  });
  await expect(table).toHaveAttribute("aria-rowcount", "32");
  await expect(region.locator("tbody tr[aria-rowindex]").first()).toBeVisible();
  await region.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  await expect(
    page.locator("[data-load-progress]:visible").getByRole("alert"),
  ).toContainText("Le chargement a échoué");
  await expect(page.locator("[data-load-progress]:visible")).toContainText(
    "25 résultats affichés sur 31",
  );
  expect(calls).toBe(1);
  await page.getByRole("button", { name: "Réessayer", exact: true }).click();
  await expect(page.locator("[data-load-progress]:visible")).toContainText(
    "31 résultats affichés sur 31",
  );
  expect(calls).toBe(2);
  await page.getByRole("tab", { name: "Vue cartes", exact: true }).click();
  await expect(page.getByRole("article")).toHaveCount(31);
  expect(new URL(page.url()).searchParams.has("page")).toBe(false);
});

test("async table discards a pending old search and refuses mixed releases", async ({
  page,
}) => {
  let finish: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    finish = resolve;
  });
  let started = false;
  await page.route("**/api/workspace/formations?**", async (route) => {
    if (new URL(route.request().url()).searchParams.get("page") !== "2")
      return route.continue();
    started = true;
    await gate;
    try {
      await route.continue();
    } catch {
      /* The obsolete request was cancelled. */
    }
  });
  try {
    await page.goto("/formations?vue=liste");
    await expect(page.getByRole("searchbox")).toBeEditable();
    const region = page.getByRole("region", {
      name: "Résultats de la recherche",
    });
    await expect(
      region.locator("tbody tr[aria-rowindex]").first(),
    ).toBeVisible();
    await region.evaluate((element) => {
      element.scrollTop = element.scrollHeight;
    });
    await expect.poll(() => started).toBe(true);
    await page.getByRole("searchbox").fill("Systèmes");
    await page.getByRole("button", { name: "Rechercher", exact: true }).click();
    await expect(page).toHaveURL(/q=Syst/);
    finish();
    await expect(page.locator("[data-load-progress]:visible")).toContainText(
      "1 résultat affiché sur 1",
    );
    await expect(
      page.getByRole("table", { name: "Résultats de la recherche" }),
    ).toHaveAttribute("aria-rowcount", "2");
  } finally {
    finish();
  }
  await page.unroute("**/api/workspace/formations?**");
  await page.route("**/api/workspace/formations?**", async (route) => {
    if (new URL(route.request().url()).searchParams.get("page") !== "2")
      return route.continue();
    const response = await route.fetch();
    const payload = await response.json();
    const version = "22222222-2222-4222-8222-222222222222";
    payload.result.data.source.releaseId = version;
    for (const row of payload.result.data.formations)
      row.id = `${version}:${row.id.split(":")[1]}`;
    await route.fulfill({ json: payload });
  });
  await page.goto("/formations?vue=liste");
  await expect(page.getByRole("searchbox")).toBeEditable();
  await expect(
    page.getByRole("button", { name: "Charger la suite", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("region", { name: "Résultats de la recherche" }).focus();
  await page.keyboard.press("End");
  await expect(
    page.locator("[data-load-progress]:visible").getByRole("alert"),
  ).toContainText("nouvelle version");
  await expect(page.locator("[data-load-progress]:visible")).toContainText(
    "25 résultats affichés sur 31",
  );
  await expect(
    page.getByRole("button", { name: "Recharger la recherche", exact: true }),
  ).toBeVisible();
});

test("hiding a table cancels its pending batch and returning restores its loaded rows", async ({
  page,
}) => {
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let calls = 0;
  let cancelled = 0;
  page.on("requestfailed", (request) => {
    const url = new URL(request.url());
    if (
      url.pathname === "/api/workspace/formations" &&
      url.searchParams.get("page") === "2"
    )
      cancelled++;
  });
  await page.route("**/api/workspace/formations?**", async (route) => {
    if (new URL(route.request().url()).searchParams.get("page") !== "2")
      return route.continue();
    calls++;
    if (calls === 1) await gate;
    try {
      await route.continue();
    } catch {
      /* Hidden-panel requests are aborted. */
    }
  });
  try {
    await page.goto("/formations?vue=liste");
    await expect(page.getByRole("searchbox")).toBeEditable();
    await page
      .getByRole("region", { name: "Résultats de la recherche" })
      .focus();
    await page.keyboard.press("End");
    await expect.poll(() => calls).toBe(1);
    await page.getByRole("tab", { name: "Carte", exact: true }).click();
    await expect(
      page.getByRole("tab", { name: "Carte", exact: true }),
    ).toHaveAttribute("aria-selected", "true");
    release();
    await expect.poll(() => cancelled).toBe(1);
    expect(calls).toBe(1);
    await expect(
      page.locator("#formations-contenu [data-load-progress]").first(),
    ).toContainText("25 résultats affichés sur 31");
    await page.getByRole("tab", { name: "Liste", exact: true }).click();
    const region = page.getByRole("region", {
      name: "Résultats de la recherche",
    });
    await region.focus();
    await page.keyboard.press("End");
    await expect(page.locator("[data-load-progress]:visible")).toContainText(
      "31 résultats affichés sur 31",
    );
    expect(calls).toBe(2);
    await page.getByRole("tab", { name: "Carte", exact: true }).click();
    await page.getByRole("tab", { name: "Liste", exact: true }).click();
    await expect(page.locator("[data-load-progress]:visible")).toContainText(
      "31 résultats affichés sur 31",
    );
    expect(calls).toBe(2);
  } finally {
    release();
  }
});
