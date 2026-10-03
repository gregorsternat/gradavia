export function GET() {
  // Liveness only. Database readiness is checked by the explicit CLI diagnostic.
  return Response.json(
    { status: "ok" },
    { headers: { "Cache-Control": "no-store" } },
  );
}
