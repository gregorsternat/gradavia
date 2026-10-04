import { expect, test } from "vitest";
import { canonicalRedirect } from "./canonical-redirect";

test("canonical redirect preserves encoded paths and query values", () => {
  const request = new Request(
    "http://www.gradavia.com:8788/formations/a%2Fb?q=%C3%A9cole%20%26%20droit&campagne=2025&tag=a&tag=b",
  );
  const response = canonicalRedirect(request);
  expect(response?.status).toBe(308);
  expect(response?.headers.get("location")).toBe(
    "https://gradavia.com/formations/a%2Fb?q=%C3%A9cole%20%26%20droit&campagne=2025&tag=a&tag=b",
  );
});

test("canonical redirect leaves apex, local and unrelated hostnames alone", () => {
  for (const origin of [
    "https://gradavia.com",
    "http://127.0.0.1:8788",
    "https://www.gradavia.com.example.org",
  ])
    expect(canonicalRedirect(new Request(`${origin}/formations`))).toBeNull();
});
