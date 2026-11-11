// The bindings wrangler.jsonc declares, and the Worker secrets the deploy
// pushes (tooling/wire/worker-secrets.mjs), as the Worker (and `next dev`
// through the platform proxy) sees them.
interface CloudflareEnv {
  HYPERDRIVE: Hyperdrive
  ASSETS: Fetcher
  // Optional: the home page's search is not connected without them.
  ALGOLIA_APP_ID?: string
  ALGOLIA_SEARCH_API_KEY?: string
  // Optional: another search host for the browser than Algolia's own.
  ALGOLIA_HOST?: string
}
