import { getCloudflareContext } from "@opennextjs/cloudflare";

// What the browser's InstantSearch needs, read from the Worker per request.
//
// The template inlined NEXT_PUBLIC_ALGOLIA_APP_ID and
// NEXT_PUBLIC_ALGOLIA_SEARCH_API_KEY into the client bundle at build time
// (its next.config `env`, which mapped bare ALGOLIA_* names too). Here they are
// the Worker's: secrets the deploy pushes (tooling/wire/worker-secrets.mjs),
// read when the page renders and handed to the client component as props. The
// search key is Algolia's search-only key — browser-safe by design, as upstream
// says — so handing it to the page exposes nothing upstream did not. The
// write/admin key is never read: the connector indexes from Algolia's
// dashboard. ALGOLIA_HOST (optional) points the browser at another search host
// instead of Algolia's own; the e2e uses it for a local stand-in.
export type SearchConfig = { appId: string; searchApiKey: string; host?: string };

export function searchConfig(): SearchConfig | null {
  type Vars = Partial<Record<"ALGOLIA_APP_ID" | "ALGOLIA_SEARCH_API_KEY" | "ALGOLIA_HOST", string>>;
  let env: Vars;
  try {
    env = getCloudflareContext().env;
  } catch {
    env = process.env as Vars; // no Cloudflare context
  }
  const appId = env.ALGOLIA_APP_ID?.trim();
  const searchApiKey = env.ALGOLIA_SEARCH_API_KEY?.trim();
  if (!appId || !searchApiKey) return null;
  const host = env.ALGOLIA_HOST?.trim();
  return host ? { appId, searchApiKey, host } : { appId, searchApiKey };
}
