import { handle } from "./handler";
export default {
  async fetch(request: Request, env: Cloudflare.Env) {
    try {
      return await handle(request, env);
    } catch {
      return Response.json(
        { error: { code: "unavailable" } },
        {
          status: 503,
          headers: { "cache-control": "no-store", "retry-after": "5" },
        },
      );
    }
  },
} satisfies ExportedHandler<Cloudflare.Env>;
