import "server-only";
import { cache } from "react";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { z } from "zod";
import {
  detailResponse,
  explorerResponse,
  formationId,
  type DetailResult,
} from "../domain/api-contract";
import {
  FILTER_KEYS,
  type ExplorerResult,
  type SearchParams,
} from "../domain/explorer";

const RESPONSE_LIMIT = 2 * 1024 * 1024;

export async function readApi(
  path: string,
  params?: URLSearchParams,
): Promise<{ status: number; body: unknown }> {
  let stage:
    | "configuration"
    | "context"
    | "origin"
    | "request"
    | "fetch"
    | "response"
    | "body" = "configuration";
  try {
    const transport = process.env.GRADAVIA_API_TRANSPORT;
    if (transport && transport !== "service-binding")
      throw new Error("Invalid API transport");
    stage = "context";
    const service =
      transport === "service-binding"
        ? getCloudflareContext().env.GRADAVIA_API
        : undefined;
    if (transport === "service-binding" && !service)
      throw new Error("API service binding unavailable");
    stage = "origin";
    // Trusted server configuration only; never derive the API origin from a request.
    const origin = new URL(
      service
        ? "https://gradavia-api.internal"
        : (process.env.GRADAVIA_API_URL ?? ""),
    );
    if (
      !["http:", "https:"].includes(origin.protocol) ||
      origin.username ||
      origin.password ||
      origin.pathname !== "/" ||
      origin.search ||
      origin.hash
    )
      throw new Error("Invalid API origin");
    const url = new URL(path, origin);
    if (params) url.search = params.toString();
    stage = "request";
    const options: RequestInit = {
      headers: { Accept: "application/json" },
      cache: "no-store",
      // Workers Request supports manual redirects; reject their responses below.
      redirect: service ? "manual" : "error",
      signal: AbortSignal.timeout(18_000),
    };
    const serviceRequest = service ? new Request(url, options) : undefined;
    stage = "fetch";
    const response =
      service && serviceRequest
        ? await service.fetch(serviceRequest)
        : await fetch(url, options);
    stage = "response";
    if (response.status >= 300 && response.status < 400) {
      await response.body?.cancel();
      throw new Error("API redirect rejected");
    }
    if (
      !response.headers.get("content-type")?.includes("application/json") ||
      !response.body
    )
      throw new Error("API unavailable");
    stage = "body";
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let bytes = 0,
      body = "";
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > (path === "/v1/atlas" ? 32 * 1024 * 1024 : RESPONSE_LIMIT))
          throw new Error("API response exceeds limit");
        body += decoder.decode(value, { stream: true });
      }
      body += decoder.decode();
    } finally {
      await reader.cancel();
    }
    return { status: response.status, body: JSON.parse(body) as unknown };
  } catch (error) {
    // Error names can be customized; emit only known classes and fixed stages.
    const errorName =
      error instanceof Error &&
      [
        "Error",
        "TypeError",
        "RangeError",
        "SyntaxError",
        "ReferenceError",
        "URIError",
        "EvalError",
        "AbortError",
        "TimeoutError",
      ].includes(error.name)
        ? error.name
        : "UnknownError";
    console.error("API request failed.", { stage, errorName });
    throw new Error("API unavailable");
  }
}

export const loadExplorer = cache(async function loadExplorer(
  params: SearchParams,
): Promise<ExplorerResult> {
  try {
    const search = new URLSearchParams();
    // Forward bounded values without interpreting them; Rust owns normalization.
    for (const key of ["campagne", "q", ...FILTER_KEYS, "page", "tri"]) {
      const input = params[key];
      const first = Array.isArray(input) ? input[0] : input;
      if (first !== undefined)
        search.set(
          key,
          Array.from(first.trim())
            .slice(0, key === "q" ? 120 : 160)
            .join(""),
        );
    }
    const response = await readApi("/v1/formations", search);
    if (response.status !== 200) throw new Error("API unavailable");
    const result = explorerResponse.parse(response.body);
    if (result.status === "ready") {
      for (const key of FILTER_KEYS)
        result.data.facets[key].sort((a, b) => a.localeCompare(b, "fr"));
    }
    return result;
  } catch {
    // Do not print URLs, raw upstream bodies, parsing errors or request contents.
    console.error("Formation API unavailable.");
    return { status: "unavailable" };
  }
});

export const loadFormation = cache(async function loadFormation(
  id: string,
): Promise<DetailResult> {
  if (!formationId.safeParse(id).success) return { status: "not-found" };
  try {
    const response = await readApi(`/v1/formations/${encodeURIComponent(id)}`);
    if (
      response.status === 404 &&
      z
        .object({ error: z.object({ code: z.literal("not_found") }) })
        .safeParse(response.body).success
    )
      return { status: "not-found" };
    if (response.status !== 200) throw new Error("API unavailable");
    const result = detailResponse.parse(response.body);
    if (result.data.formation.id !== id)
      throw new Error("Inconsistent formation identity");
    return result;
  } catch {
    console.error("Formation API unavailable.");
    return { status: "unavailable" };
  }
});

export async function loadFormationSelection(
  ids: string[],
): Promise<{ id: string; result: DetailResult }[]> {
  // Bound both total requests and concurrent pressure on the upstream pool.
  const bounded = [...new Set(ids)].slice(0, 12);
  const results: { id: string; result: DetailResult }[] = [];
  for (let offset = 0; offset < bounded.length; offset += 4) {
    results.push(
      ...(await Promise.all(
        bounded
          .slice(offset, offset + 4)
          .map(async (id) => ({ id, result: await loadFormation(id) })),
      )),
    );
  }
  return results;
}
