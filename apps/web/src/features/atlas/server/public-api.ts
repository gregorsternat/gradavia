import "server-only";
import { loadAtlas } from "./load";
import {
  datasetCsv,
  datasetMetadata,
  datasetPath,
  parseDatasetQuery,
} from "../domain/export";
import type { AtlasResult } from "../domain/api-contract";

type Loader = (params: Record<string, string>) => Promise<AtlasResult>;
const error = (status: number, code: string) =>
  Response.json(
    { error: { code } },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
        "Access-Control-Allow-Origin": "*",
        ...(status === 503 ? { "Retry-After": "5" } : {}),
      },
    },
  );

/** A public projection of the reviewed read API; the browser never reaches PostgreSQL. */
export async function serveDataset(
  request: Request,
  loader: Loader = loadAtlas,
): Promise<Response> {
  const query = parseDatasetQuery(new URL(request.url).search);
  if (!query) return error(400, "invalid_query");
  const params: Record<string, string> = { famille: query.famille };
  if (query.campagne) params.campagne = query.campagne;
  if (query.version) params.version = query.version;
  let result: AtlasResult;
  try {
    result = await loader(params);
  } catch {
    return error(503, "unavailable");
  }
  if (result.status === "unavailable") return error(503, "unavailable");
  if (result.status === "not-found") return error(404, "not_found");
  if (result.status === "empty")
    return Response.json(result, {
      headers: {
        "Cache-Control": "no-store",
        "Access-Control-Allow-Origin": "*",
      },
    });
  const { data } = result;
  // Only a verified immutable version may receive immutable cache headers.
  if (
    data.family !== query.famille ||
    (query.version && query.version !== data.source.releaseId.toLowerCase()) ||
    (query.campagne && Number(query.campagne) !== data.source.campaign)
  )
    return error(503, "unavailable");
  const headers = new Headers({
    "Cache-Control": query.version
      ? "public, max-age=31536000, immutable"
      : "no-store",
    "Access-Control-Allow-Origin": "*",
    "X-Content-Type-Options": "nosniff",
    Link: `<${datasetPath(data, "metadata")}>; rel="describedby"`,
  });
  if (query.format === "csv") {
    headers.set("Content-Type", "text/csv; charset=utf-8");
    headers.set(
      "Content-Disposition",
      `attachment; filename="gradavia-${data.family}-${data.source.campaign}-${data.source.releaseId}.csv"`,
    );
    return new Response(datasetCsv(data), { headers });
  }
  const stableData = query.version
    ? { ...data, campaigns: [data.source.campaign] }
    : data;
  return Response.json(
    query.format === "metadata"
      ? datasetMetadata(data)
      : { status: "ready", data: stableData, metadata: datasetMetadata(data) },
    { headers },
  );
}
