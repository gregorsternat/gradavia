import { describe, expect, test } from "vitest";
import {
  adoptSharedComparison,
  EMPTY_SELECTION,
  parseSelectionIds,
  readSavedSelection,
  selectionUrl,
  toggleSavedSelection,
  type SavedFormation,
} from "./selection";
const row = (number: number, campaign = 2025): SavedFormation => ({
  id: `11111111-1111-4111-8111-111111111111:${number}`,
  campaign,
  title: `Formation ${number}`,
  establishment: null,
});

describe("local formation selection", () => {
  test("bounds and deduplicates untrusted URL identities", () => {
    const ids = [
      row(1).id,
      "../../../private",
      row(1).id,
      ...Array.from({ length: 8 }, (_, index) => row(index + 2).id),
    ].join(",");
    expect(parseSelectionIds(ids)).toEqual(
      [1, 2, 3, 4].map((index) => row(index).id),
    );
    const url = new URL(
      selectionUrl(parseSelectionIds(ids)),
      "https://orvio.test",
    );
    expect(parseSelectionIds(url.searchParams.get("ids")!)).toEqual(
      parseSelectionIds(ids),
    );
  });
  test("enforces one campaign and a maximum of four compared formations without losing existing work", () => {
    let selection = EMPTY_SELECTION;
    for (let index = 1; index <= 4; index++)
      selection = toggleSavedSelection(
        selection,
        "comparison",
        row(index),
      ).selection;
    expect(
      toggleSavedSelection(selection, "comparison", row(5)).error,
    ).toContain("4 formations");
    expect(
      toggleSavedSelection(selection, "comparison", row(6, 2024)).selection,
    ).toBe(selection);
    expect(
      toggleSavedSelection(selection, "comparison", row(6, 2024)).error,
    ).toContain("2025");
    const removed = toggleSavedSelection(selection, "comparison", row(2));
    expect(removed.selection.comparison.map((item) => item.id)).toEqual(
      [1, 3, 4].map((index) => row(index).id),
    );
    expect(removed.error).toBeNull();
  });
  test("treats malformed browser storage as empty and validates each stored entry", () => {
    expect(readSavedSelection("{broken")).toEqual(EMPTY_SELECTION);
    expect(
      readSavedSelection(
        JSON.stringify({
          favorites: [
            row(1),
            row(1),
            { ...row(2), campaign: "2025" },
            { ...row(3), title: null },
          ],
          comparison: [row(1), row(2, 2024)],
        }),
      ),
    ).toEqual({ favorites: [row(1)], comparison: [row(1)] });
  });
  test("adopts a shared comparison atomically while preserving favorites and campaign constraints", () => {
    const current = { favorites: [row(9)], comparison: [row(8, 2024)] };
    const adopted = adoptSharedComparison(current, [row(1), row(2), row(1)]);
    expect(adopted).toEqual({
      selection: { favorites: [row(9)], comparison: [row(1), row(2)] },
      error: null,
    });
    expect(
      toggleSavedSelection(adopted.selection, "comparison", row(3)).selection
        .comparison,
    ).toEqual([row(1), row(2), row(3)]);
    expect(
      adoptSharedComparison(current, [row(1), row(2, 2024)]).selection,
    ).toBe(current);
    expect(
      adoptSharedComparison(
        current,
        Array.from({ length: 5 }, (_, index) => row(index + 1)),
      ).selection,
    ).toBe(current);
    expect(current).toEqual({
      favorites: [row(9)],
      comparison: [row(8, 2024)],
    });
  });
});
