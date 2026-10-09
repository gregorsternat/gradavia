import { isPanel } from "@/features/workspace/domain/registry";
import { loadPanel } from "@/features/workspace/server/load";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ panel: string }> },
) {
  const { panel } = await params;
  if (!isPanel(panel))
    return Response.json({ error: "Unknown panel" }, { status: 404 });
  const url = new URL(request.url);
  if (url.search.length > 16_384)
    return Response.json({ error: "Query too large" }, { status: 400 });
  const data = await loadPanel(panel, url.searchParams.toString());
  return Response.json(data, {
    headers: {
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}
