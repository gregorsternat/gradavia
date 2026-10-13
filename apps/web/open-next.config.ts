import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import staticAssetsIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/static-assets-incremental-cache";

// Build-time pages use assets. Validated public data has its own bounded Cache API
// cache; it does not depend on Next's incremental page/fetch cache.
export default defineCloudflareConfig({
  incrementalCache: staticAssetsIncrementalCache,
});
