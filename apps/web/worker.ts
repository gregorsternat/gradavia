// @ts-expect-error OpenNext generates the JavaScript entrypoint during cf:build.
import nextHandler from "./.open-next/worker.js";
import { canonicalRedirect } from "./cloudflare/canonical-redirect";

export default {
  async fetch(request, env, ctx) {
    // Preserve encoded search values before the adapter parses redirect queries.
    return canonicalRedirect(request) ?? nextHandler.fetch(request, env, ctx);
  },
} satisfies ExportedHandler<CloudflareEnv>;
