// OpenNext Cloudflare adapter config.
//
// Nothing here is cached across requests: the home page and the product pages
// render per request (the Algolia secrets and the database are read at
// render), and only the not-found page is prerendered. The static-assets
// incremental cache serves that one prerendered page straight from the
// Worker's static assets (read only, no R2/KV/D1 to provision). A template
// that revalidates (ISR, `revalidateTag`) swaps this for the R2 incremental
// cache plus a tag cache.
import { defineCloudflareConfig } from "@opennextjs/cloudflare/config";
import staticAssetsIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/static-assets-incremental-cache";

export default defineCloudflareConfig({
  incrementalCache: staticAssetsIncrementalCache,
});
