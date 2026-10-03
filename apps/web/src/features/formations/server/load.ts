import "server-only";
import { explorerResponse } from "../domain/api-contract";
import {
  FILTER_KEYS,
  type ExplorerResult,
  type SearchParams,
} from "../domain/explorer";

const RESPONSE_LIMIT = 2 * 1024 * 1024;

export async function loadExplorer(
  params: SearchParams,
): Promise<ExplorerResult> {
  try {
    // Trusted server configuration only; never derive the API origin from a request.
    const origin = new URL(process.env.ORVIO_API_URL ?? "");
    if (
      !["http:", "https:"].includes(origin.protocol) ||
      origin.username ||
      origin.password ||
      origin.pathname !== "/" ||
      origin.search ||
      origin.hash
    )
      throw new Error("Invalid API origin");
    const url = new URL("/v1/formations", origin);
    // Forward bounded values without interpreting them; Rust owns normalization.
    for (const key of ["campagne", "q", ...FILTER_KEYS, "page"]) {
      const input = params[key];
      const first = Array.isArray(input) ? input[0] : input;
      if (first !== undefined)
        url.searchParams.set(
          key,
          Array.from(first.trim())
            .slice(0, key === "q" ? 120 : 160)
            .join(""),
        );
    }
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(18_000),
    });
    if (
      !response.ok ||
      !response.headers.get("content-type")?.includes("application/json") ||
      !response.body
    )
      throw new Error("API unavailable");
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let bytes = 0,
      body = "";
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > RESPONSE_LIMIT)
          throw new Error("API response exceeds limit");
        body += decoder.decode(value, { stream: true });
      }
      body += decoder.decode();
    } finally {
      await reader.cancel();
    }
    const result = explorerResponse.parse(JSON.parse(body));
    if (result.status === "ready") {
      // Locale ordering is presentation only; the API owns filter membership.
      for (const key of FILTER_KEYS)
        result.data.facets[key].sort((a, b) => a.localeCompare(b, "fr"));
    }
    return result;
  } catch {
    // Do not print URLs, raw upstream bodies, parsing errors or request contents.
    console.error("Formation API unavailable.");
    return { status: "unavailable" };
  }
}
