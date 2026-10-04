type ForwardRequest = (request: Request) => Promise<Response>;

function errorResponse(
  code: string,
  status: number,
  headers?: Record<string, string>,
) {
  return Response.json(
    { error: { code } },
    { status, headers: { "Cache-Control": "no-store", ...headers } },
  );
}

export async function proxyApiRequest(
  request: Request,
  forward: ForwardRequest,
): Promise<Response> {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return errorResponse("method_not_allowed", 405, { Allow: "GET, HEAD" });
  }

  const url = new URL(request.url);
  if (
    !url.pathname.startsWith("/v1/") &&
    url.pathname !== "/health/live" &&
    url.pathname !== "/health/ready"
  ) {
    return errorResponse("not_found", 404);
  }

  // Keep the source query, but never relay caller credentials or origin headers.
  const target = new URL("http://container");
  target.pathname = url.pathname;
  target.search = url.search;

  try {
    const signal = AbortSignal.any([
      request.signal,
      AbortSignal.timeout(17_000),
    ]);
    signal.throwIfAborted();
    const response = await forward(
      new Request(target, {
        method: request.method,
        headers: { Accept: "application/json" },
        redirect: "manual",
        signal,
      }),
    );
    // Startup failures from the SDK may be text responses rather than exceptions.
    if (response.status >= 500 || response.status === 429) {
      await response.body?.cancel();
      return errorResponse("unavailable", 503, { "Retry-After": "5" });
    }
    return response;
  } catch {
    return errorResponse("unavailable", 503, { "Retry-After": "5" });
  }
}
