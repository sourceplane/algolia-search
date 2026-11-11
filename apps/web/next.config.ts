import path from "node:path";
import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

// `next dev` reaches the Hyperdrive binding (and .dev.vars' Algolia secrets)
// through wrangler's local platform proxy (render apps/web/wrangler.jsonc
// first: `pnpm run wire:fixture`).
initOpenNextCloudflareForDev();

// Not the template's `env` block: it inlined the Algolia app id and search key
// into the browser bundle at BUILD time. They are the Worker's secrets here,
// read per request (lib/algolia.ts), so the build never sees them.
const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname, "../.."),
  turbopack: { root: path.join(__dirname, "../..") },
  // `pg` is one of Next's server-external packages, so the build traces it for
  // NODE and copies only pg-cloudflare's `default` export (dist/empty.js);
  // OpenNext's bundler then resolves its `workerd` export, the Cloudflare
  // socket pg uses on Workers, and fails "Could not resolve pg-cloudflare".
  // Ship the whole package so both resolve.
  outputFileTracingIncludes: {
    "*": ["../../node_modules/.pnpm/pg-cloudflare@*/node_modules/pg-cloudflare/**"],
  },
};

export default nextConfig;
