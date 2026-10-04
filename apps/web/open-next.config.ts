import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import staticAssetsIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/static-assets-incremental-cache";

// Dataset reads stay request-time and uncached; only build-time pages use assets.
export default defineCloudflareConfig({
  incrementalCache: staticAssetsIncrementalCache,
});
