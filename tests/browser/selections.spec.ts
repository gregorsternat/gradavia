import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "./fixtures";

test("named lists retain notes and progress across reloads and synchronize tabs", async ({
  page,
  context,
}) => {
  await page.goto("/favoris");
  await expect(
    page.getByRole("button", { name: "Liste de formations" }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "Nouvelle liste", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Nom de la liste" })
    .fill("À discuter");
  await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "À discuter",
  );
  await page.goto("/formations?q=Droit&vue=cartes");
  for (const number of ["01", "02", "03"]) {
    await page
      .getByRole("button", {
        name: `Ajouter aux favoris : Licence - Droit ${number}`,
        exact: true,
      })
      .click();
  }
  await page.goto("/favoris");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "À discuter3",
  );
  await expect(
    page.getByRole("heading", { name: "Répartition de la sélection" }),
  ).toBeVisible();
  await expect(page.locator(".recharts-wrapper svg").first()).toBeVisible();
  const editor = page.locator("details").filter({
    has: page.getByLabel("Notes pour Licence - Droit 01"),
  });
  await editor.locator("summary").click();
  await page
    .getByRole("textbox", { name: "Notes pour Licence - Droit 01" })
    .fill("Vérifier le contenu des cours");
  await page.getByRole("tab", { name: "Budget", exact: true }).click();
  await page.getByRole("tab", { name: "Favoris", exact: true }).click();
  await expect(editor).toHaveAttribute("open", "");
  await expect(
    page.getByRole("textbox", { name: "Notes pour Licence - Droit 01" }),
  ).toHaveValue("Vérifier le contenu des cours");
  expect(decodeURIComponent(page.url())).not.toContain(
    "Vérifier le contenu des cours",
  );
  await page
    .getByRole("textbox", { name: "Nouvelle démarche pour Licence - Droit 01" })
    .fill("Contacter la formation");
  await editor.getByRole("button", { name: "Ajouter", exact: true }).click();
  await page
    .getByRole("checkbox", { name: "Contacter la formation", exact: true })
    .click();
  const status = page.getByRole("button", {
    name: "Suivi de Licence - Droit 01",
  });
  await status.focus();
  await page.keyboard.press("ArrowDown");
  await page
    .getByRole("option", { name: "Dossier préparé", exact: true })
    .click();
  await page.reload();
  const savedEditor = page.locator("details").filter({
    has: page.getByLabel("Notes pour Licence - Droit 01"),
  });
  await expect(savedEditor.locator("summary")).toContainText("Dossier préparé");
  await savedEditor.locator("summary").click();
  await expect(
    page.getByRole("textbox", { name: "Notes pour Licence - Droit 01" }),
  ).toHaveValue("Vérifier le contenu des cours");
  await expect(
    page.getByRole("checkbox", { name: "Contacter la formation", exact: true }),
  ).toHaveAttribute("aria-checked", "true");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  const other = await context.newPage();
  await other.goto("/favoris");
  await expect(other.getByRole("heading", { level: 1 })).toHaveText(
    "À discuter3",
  );
  await page
    .getByRole("button", {
      name: "Retirer des favoris : Licence - Droit 03",
      exact: true,
    })
    .click();
  await expect(other.getByRole("heading", { level: 1 })).toHaveText(
    "À discuter2",
  );
  await other.close();
  await page.emulateMedia({ media: "print" });
  await expect(page.locator("#selection-dossier")).toBeVisible();
  await expect(page.locator("#selection-dossier")).toContainText(
    "Vérifier le contenu des cours",
  );
  await expect(page.locator("#selection-dossier")).toContainText("Version :");
  await expect(page.locator("#selection-dossier")).toContainText(
    "Fait · Contacter la formation",
  );
  await expect(page.locator("#selection-dossier article")).toHaveCount(2);
});

test("sharing excludes notes by default and imports an explicit annotated copy", async ({
  page,
  browser,
}) => {
  await page.goto("/formations?q=Droit+01&vue=cartes");
  await page
    .getByRole("button", {
      name: "Ajouter aux favoris : Licence - Droit 01",
      exact: true,
    })
    .click();
  await page.goto("/favoris");
  const editor = page.locator("details").filter({
    has: page.getByLabel("Notes pour Licence - Droit 01"),
  });
  await editor.locator("summary").click();
  await page
    .getByRole("textbox", { name: "Notes pour Licence - Droit 01" })
    .fill("Une question privée");
  await page.getByText("Partager cette liste", { exact: true }).click();
  await page
    .getByRole("button", { name: "Copier le lien", exact: true })
    .click();
  const ordinary = await page
    .getByRole("textbox", { name: "Lien de partage" })
    .inputValue();
  expect(decodeURIComponent(ordinary)).not.toContain("Une question privée");
  await page
    .getByRole("checkbox", { name: "Inclure mes notes, démarches et suivi" })
    .click();
  await page
    .getByRole("button", { name: "Copier le lien", exact: true })
    .click();
  const annotated = await page
    .getByRole("textbox", { name: "Lien de partage" })
    .inputValue();
  expect(decodeURIComponent(new URL(annotated).hash)).toContain(
    "Une question privée",
  );
  expect(new URL(annotated).search).not.toContain("privée");
  const recipient = await browser.newContext();
  const shared = await recipient.newPage();
  await shared.goto(annotated);
  await expect(
    shared
      .getByRole("main")
      .getByText("Une question privée", { exact: true })
      .filter({ visible: true }),
  ).toBeVisible();
  await shared
    .getByRole("button", { name: "Enregistrer cette liste", exact: true })
    .click();
  await expect(
    shared.getByRole("button", { name: "Renommer la liste" }),
  ).toBeVisible();
  await shared.reload();
  const recipientEditor = shared.locator("details").filter({
    has: shared.getByLabel("Notes pour Licence - Droit 01"),
  });
  await recipientEditor.locator("summary").click();
  await expect(
    shared.getByRole("textbox", { name: "Notes pour Licence - Droit 01" }),
  ).toHaveValue("Une question privée");
  await recipient.close();
});

test("shared lists larger than one page import and print every formation", async ({
  page,
}) => {
  await page.goto("/formations?q=Droit&vue=cartes");
  await expect(
    page.getByRole("link", { name: "Licence - Droit 01", exact: true }),
  ).toBeVisible();
  const links = await page
    .getByRole("link", { name: /^Licence - Droit \d+$/ })
    .evaluateAll((elements) =>
      elements
        .slice(0, 13)
        .map((element) =>
          decodeURIComponent(
            (element as HTMLAnchorElement).pathname.split("/").at(-1)!,
          ),
        ),
    );
  expect(links).toHaveLength(13);
  await page.goto(
    `/favoris?${new URLSearchParams({ ids: links.join(","), partage: "1" })}`,
  );
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Liste partagée13",
  );
  await page
    .getByRole("button", { name: "Enregistrer cette liste", exact: true })
    .click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Liste partagée13",
  );
  await expect(
    page.getByRole("navigation", { name: "Pagination des favoris" }),
  ).toContainText("Page 1 sur 2");
  await page.getByRole("button", { name: "Suivante", exact: true }).click();
  await expect(
    page.getByRole("navigation", { name: "Pagination des favoris" }),
  ).toContainText("Page 2 sur 2");
  await page.emulateMedia({ media: "print" });
  await expect(page.locator("#selection-dossier article")).toHaveCount(13);
});
