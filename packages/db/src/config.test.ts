import { describe, expect, it } from "vitest";
import { validateDatabaseUrl } from "./config";

describe("database configuration", () => {
  it("accepts a direct local URL and a pooled application URL", () => {
    expect(validateDatabaseUrl("postgres://localhost/orvio", true)).toContain(
      "orvio",
    );
    expect(
      validateDatabaseUrl("postgres://ep-name-pooler.neon.tech/neondb"),
    ).toContain("pooler");
  });

  it.each([
    undefined,
    "",
    "postgres://localhost",
    "https://user:secret@example.com/db",
  ])(
    "rejects malformed configuration without disclosing the value",
    (value) => {
      expect(() => validateDatabaseUrl(value)).toThrow(
        "PostgreSQL connection URL",
      );
      try {
        validateDatabaseUrl(value);
      } catch (error) {
        expect(String(error)).not.toContain("secret");
      }
    },
  );

  it("rejects pooled URLs for migrations", () => {
    expect(() =>
      validateDatabaseUrl("postgres://ep-name-pooler.neon.tech/neondb", true),
    ).toThrow("direct");
  });
});
