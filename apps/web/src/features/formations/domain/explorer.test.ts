import { describe, expect, test } from "vitest";
import { decodeFormationRouteId } from "./api-contract";
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
      tri: "capacite",
    });
    const search = new URL(explorerUrl(query), "https://orvio.test")
      .searchParams;
    expect(search.get("q")).toBe("droit & santé");
    expect(search.get("type")).toBe("Licence");
    expect(search.has("page")).toBe(false);
    expect(search.get("tri")).toBe("capacite");
    expect(parseQuery({ tri: "unsupported" }).tri).toBe("nom");
    expect(explorerUrl(query, 4)).toContain("page=4");
  });
});

test("formation route identities decode one URI layer and reject malformed segments", () => {
  const id = "11111111-1111-4111-8111-111111111111:2";
  expect(decodeFormationRouteId(id)).toBe(id);
  expect(decodeFormationRouteId(encodeURIComponent(id))).toBe(id);
  expect(
    decodeFormationRouteId(encodeURIComponent(encodeURIComponent(id))),
  ).toBeNull();
  expect(decodeFormationRouteId("%E0%A4%A")).toBeNull();
  expect(decodeFormationRouteId("..%2Fprivate")).toBeNull();
});
