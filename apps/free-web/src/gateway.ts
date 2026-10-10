/** One deployment switches the complete immutable publication and its read Worker. */
type Fetcher = { fetch(request: Request): Promise<Response> };
export type GatewayEnv = {
  CURRENT: Fetcher;
  CURRENT_ID: string;
  PREVIOUS?: Fetcher;
  PREVIOUS_ID?: string;
};
export async function gateway(
  request: Request,
  env: GatewayEnv,
): Promise<Response> {
  const requested = request.headers.get("x-gradavia-publication");
  if (
    requested &&
    requested !== env.CURRENT_ID &&
    requested !== env.PREVIOUS_ID
  )
    return Response.json(
      { error: { code: "publication_expired" } },
      { status: 409, headers: { "cache-control": "no-store" } },
    );
  const service =
    requested === env.PREVIOUS_ID && env.PREVIOUS ? env.PREVIOUS : env.CURRENT;
  let response = await service.fetch(request);
  // An already-open tab can still request chunks from the previous Next build.
  if (
    response.status === 404 &&
    new URL(request.url).pathname.startsWith("/_next/static/") &&
    env.PREVIOUS
  )
    response = await env.PREVIOUS.fetch(request);
  const headers = new Headers(response.headers);
  headers.set("x-gradavia-publication", requested ?? env.CURRENT_ID);
  return new Response(response.body, { status: response.status, headers });
}
const gatewayWorker = { fetch: gateway };
export default gatewayWorker;
