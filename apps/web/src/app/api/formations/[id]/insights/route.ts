import { decodeFormationRouteId } from "@/features/formations/domain/api-contract";
import { loadFormationInsights } from "@/features/formations/server/insights";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const id = decodeFormationRouteId((await params).id);
  const result = id
    ? await loadFormationInsights(id)
    : { status: "not-found" as const };
  return Response.json(result, {
    status:
      result.status === "ready"
        ? 200
        : result.status === "not-found"
          ? 404
          : 503,
    headers: {
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}
