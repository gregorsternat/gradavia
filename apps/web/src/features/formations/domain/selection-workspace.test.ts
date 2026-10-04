import { describe, expect, test } from "vitest";
import {
  MAX_FAVORITES,
  MAX_LISTS,
  readSavedSelection,
  readSelectionTasks,
  removeSavedFavorite,
  selectionUpdates,
  type SavedFormation,
} from "./selection";
import {
  comparisonComments,
  concentrationFacts,
  demandDistribution,
  readSharedList,
  selectionDistribution,
  shareListUrl,
} from "./selection-workspace";
import type { FormationDetail } from "./api-contract";

const observed = (value: number | null) => ({
  value,
  state: value === null ? ("missing" as const) : ("observed" as const),
  sourceField: "published",
});
const row = (index: number): SavedFormation => ({
  id: `11111111-1111-4111-8111-111111111111:${index}`,
  campaign: 2025,
  title: `Formation ${index}`,
  establishment: null,
  summary: {
    city: "Paris",
    region: "Île-de-France",
    type: "Licence",
    capacity: observed(20),
    applications: observed(index * 100),
    accessRate: observed(null),
  },
});

describe("selection workspace", () => {
  test("bounds user-authored checklist items and includes them only with explicit sharing", () => {
    const tasks = readSelectionTasks([
      { id: "first", label: " Contacter la formation ", done: true },
      { id: "first", label: "Duplicate", done: false },
      { id: "bad", label: "Invalid", done: "yes" },
      ...Array.from({ length: 30 }, (_, index) => ({
        id: `task-${index}`,
        label: "a".repeat(200),
        done: false,
      })),
    ]);
    expect(tasks).toHaveLength(20);
    expect(tasks[0]).toEqual({
      id: "first",
      label: "Contacter la formation",
      done: true,
    });
    expect(tasks[1]!.label).toHaveLength(160);
    const notes = {
      [row(1).id]: { note: "", status: "discover" as const, tasks },
    };
    const saved = readSavedSelection(
      JSON.stringify({ favorites: [row(1)], comparison: [], notes }),
    );
    expect(saved.notes).toEqual(notes);
    const privateUrl = new URL(
      shareListUrl([row(1).id], "Liste", notes)!,
      "https://gradavia.com",
    );
    expect(readSharedList(privateUrl.hash, [row(1).id]).notes).toEqual({});
    const explicitUrl = new URL(
      shareListUrl([row(1).id], "Liste", notes, true)!,
      "https://gradavia.com",
    );
    expect(readSharedList(explicitUrl.hash, [row(1).id]).notes).toEqual(notes);
  });
  test("migrates legacy selections and bounds untrusted lists and annotations", () => {
    const favorites = Array.from({ length: MAX_FAVORITES + 5 }, (_, index) =>
      row(index + 1),
    );
    const value = readSavedSelection(
      JSON.stringify({
        favorites,
        comparison: [],
        lists: Array.from({ length: MAX_LISTS + 2 }, (_, index) => ({
          id: `list-${index}`,
          name: "A".repeat(100),
          ids: [row(1).id, row(1).id, "invalid", row(999).id],
        })),
        activeListId: "untrusted",
        notes: {
          [row(1).id]: { note: "x".repeat(3000), status: "prepared" },
          [row(2).id]: { note: "note", status: "toString" },
          unknown: { note: "orphan", status: "discover" },
        },
      }),
    );
    expect(value.favorites).toHaveLength(MAX_FAVORITES);
    expect(value.lists).toHaveLength(MAX_LISTS);
    expect(value.lists![0]).toEqual({
      id: "list-0",
      name: "A".repeat(60),
      ids: [row(1).id],
    });
    expect(value.activeListId).toBeUndefined();
    expect(value.notes![row(1).id]?.note).toHaveLength(2000);
    expect(value.notes![row(2).id]?.status).toBe("discover");
    expect(value.notes).not.toHaveProperty("unknown");
    const removed = removeSavedFavorite(value, row(1).id);
    expect(removed.lists!.every((list) => !list.ids.includes(row(1).id))).toBe(
      true,
    );
    expect(removed.notes).not.toHaveProperty(row(1).id);
  });

  test("shares identifiers without personal annotations by default and uses fragments only after opt-in", () => {
    const notes = {
      [row(1).id]: {
        note: "Demander à mon professeur",
        status: "explore" as const,
      },
    };
    const ordinary = new URL(
      shareListUrl([row(1).id], "Près de chez moi", notes)!,
      "https://gradavia.com",
    );
    expect(ordinary.searchParams.get("ids")).toBe(row(1).id);
    expect(ordinary.searchParams.get("partage")).toBe("1");
    expect(ordinary.hash).toBe("");
    expect(readSharedList(ordinary.hash, [row(1).id]).notes).toEqual({});
    const opted = new URL(
      shareListUrl([row(1).id], "Près de chez moi", notes, true)!,
      "https://gradavia.com",
    );
    expect(opted.search).not.toContain("professeur");
    expect(readSharedList(opted.hash, [row(1).id])).toEqual({
      name: "Près de chez moi",
      notes,
    });
    expect(readSharedList(opted.hash, [row(2).id]).notes).toEqual({});
    expect(readSharedList("#%broken", [row(1).id])).toEqual({
      name: "Liste partagée",
      notes: {},
    });
    expect(
      shareListUrl(
        Array.from({ length: 100 }, (_, index) => row(index + 1).id),
        "Toutes",
        {},
      ),
    ).not.toBeNull();
    const longNotes = Object.fromEntries(
      Array.from({ length: 100 }, (_, index) => [
        row(index + 1).id,
        { note: "é".repeat(2000), status: "discover" as const },
      ]),
    );
    expect(
      shareListUrl(
        Array.from({ length: 100 }, (_, index) => row(index + 1).id),
        "Toutes",
        longNotes,
        true,
      ),
    ).toBeNull();
  });

  test("keeps missing and zero capacities out of ratios and qualifies concentration", () => {
    const missing = { ...row(4), summary: undefined };
    const zero = {
      ...row(5),
      summary: { ...row(5).summary!, capacity: observed(0) },
    };
    const rows = [row(1), row(2), row(3), missing, zero];
    expect(selectionDistribution(rows, "city")).toEqual([
      { label: "Paris", count: 4 },
      { label: "Non renseigné", count: 1 },
    ]);
    expect(concentrationFacts(rows)).toContain("4 formations sur 5 à Paris.");
    expect(concentrationFacts([row(1), row(2)])).toEqual([]);
    expect(demandDistribution(rows)).toEqual([
      { label: "De 5 à moins de 20", count: 3 },
      { label: "Non calculable", count: 2 },
    ]);
  });

  test("announces only documented continuity and rejects cross-campaign comments", () => {
    const detail = {
      formation: { id: row(1).id },
      source: { campaign: 2025 },
      history: [
        {
          campaign: 2026,
          formationId: row(2).id,
          continuity: "same-source-identity",
        },
        {
          campaign: 2025,
          formationId: row(3).id,
          continuity: "same-source-identity",
        },
        {
          campaign: 2026,
          formationId: row(4).id,
          continuity: "changed-description",
        },
        {
          campaign: 2024,
          formationId: row(5).id,
          continuity: "same-source-identity",
        },
      ],
    } as FormationDetail;
    expect(selectionUpdates(detail)).toEqual([
      { id: row(2).id, label: "Campagne 2026 disponible" },
    ]);
    expect(
      comparisonComments([
        detail,
        { ...detail, source: { ...detail.source, campaign: 2024 } },
      ]),
    ).toEqual([]);
  });

  test("comments preserve displayed positions when a formation is unavailable and qualify denominators", () => {
    const detail = (
      index: number,
      capacity: number,
      applications: number,
      generalBacShare: number,
    ) =>
      ({
        formation: {
          id: row(index).id,
          city: "Paris",
          metrics: {
            capacity: observed(capacity),
            applications: observed(applications),
            generalBacShare: observed(generalBacShare),
            accessRate: observed(null),
          },
        },
        source: { campaign: 2025 },
      }) as FormationDetail;
    const comments = comparisonComments(
      [detail(2, 10, 50, 20), detail(3, 20, 200, 80)],
      [row(1).id, row(2).id, row(3).id],
    );
    expect(comments).toContain(
      "La capacité va de 10 places (formation 2) à 20 (formation 3).",
    );
    expect(comments).toContain(
      "La part de bacheliers généraux parmi les néo-bacheliers admis va de 20 à 80 % dans les 2 formations renseignées.",
    );
    expect(comments).toContain(
      "La demande observée va de 5 à 10 candidatures par place dans les 2 formations calculables.",
    );
  });
});
