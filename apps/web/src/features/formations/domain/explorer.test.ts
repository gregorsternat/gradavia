import { describe, expect, test } from "vitest";
import { explorerUrl, parseQuery } from "./explorer";

describe("explorer input and source semantics", () => {
  test("bounds untrusted GET inputs and rejects invalid page/campaign numbers", () => {
    const query = parseQuery({
      campagne: "2025",
      q: ["  École   de droit  ", "ignored"],
      page: "-2",
      region: "x".repeat(200),
    });
    expect(query).toMatchObject({
      campagne: 2025,
      q: "École de droit",
      page: 1,
    });
    expect(query.region).toHaveLength(160);
    expect(
      parseQuery({ campagne: "2025 OR 1=1", page: "Infinity" }),
    ).toMatchObject({ campagne: null, page: 1 });
    expect(parseQuery({ page: "99999999999999" }).page).toBe(1);
  });
  test("preserves filters in links while new searches reset pagination", () => {
    const query = parseQuery({
      campagne: "2025",
      q: "droit & santé",
      type: "Licence",
      page: "3",
    });
    const search = new URL(explorerUrl(query), "https://orvio.test")
      .searchParams;
    expect(search.get("q")).toBe("droit & santé");
    expect(search.get("type")).toBe("Licence");
    expect(search.has("page")).toBe(false);
    expect(explorerUrl(query, 4)).toContain("page=4");
  });
});
