import { beforeEach, describe, expect, it, vi } from "vitest";

// lib/algolia.ts: the browser's InstantSearch config, read from the Worker per
// request — the template inlined NEXT_PUBLIC_ variables at build time.
let cf: { env: Record<string, string | undefined> } | null = null;
vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: () => {
    if (!cf) throw new Error("no Cloudflare context");
    return cf;
  },
}));

beforeEach(() => {
  cf = null;
  for (const k of ["ALGOLIA_APP_ID", "ALGOLIA_SEARCH_API_KEY", "ALGOLIA_HOST"]) delete process.env[k];
  vi.resetModules();
});

async function config() {
  const { searchConfig } = await import("@/lib/algolia");
  return searchConfig();
}

describe("searchConfig (lib/algolia.ts)", () => {
  it("is the Worker's application id and search-only key", async () => {
    cf = { env: { ALGOLIA_APP_ID: " APP1 ", ALGOLIA_SEARCH_API_KEY: "search-key" } };
    expect(await config()).toEqual({ appId: "APP1", searchApiKey: "search-key" });
  });

  it("is null — search not connected — until both are set", async () => {
    cf = { env: {} };
    expect(await config()).toBeNull();
    cf = { env: { ALGOLIA_APP_ID: "APP1" } };
    expect(await config()).toBeNull();
    cf = { env: { ALGOLIA_SEARCH_API_KEY: "search-key" } };
    expect(await config()).toBeNull();
    cf = { env: { ALGOLIA_APP_ID: "  ", ALGOLIA_SEARCH_API_KEY: "search-key" } };
    expect(await config()).toBeNull();
  });

  it("carries another search host only when ALGOLIA_HOST is set", async () => {
    cf = { env: { ALGOLIA_APP_ID: "APP1", ALGOLIA_SEARCH_API_KEY: "k", ALGOLIA_HOST: "http://127.0.0.1:9" } };
    expect(await config()).toEqual({ appId: "APP1", searchApiKey: "k", host: "http://127.0.0.1:9" });
  });

  it("never hands out any other key, the write/admin key above all", async () => {
    cf = {
      env: { ALGOLIA_APP_ID: "APP1", ALGOLIA_SEARCH_API_KEY: "k", ALGOLIA_WRITE_API_KEY: "admin", ALGOLIA_ADMIN_API_KEY: "admin" },
    };
    const c = await config();
    expect(JSON.stringify(c)).not.toContain("admin");
    expect(Object.keys(c ?? {}).sort()).toEqual(["appId", "searchApiKey"]);
  });

  it("reads the process environment without a Cloudflare context", async () => {
    process.env.ALGOLIA_APP_ID = "APP2";
    process.env.ALGOLIA_SEARCH_API_KEY = "k2";
    expect(await config()).toEqual({ appId: "APP2", searchApiKey: "k2" });
  });

  it("is never read at build time: no NEXT_PUBLIC_ name, and next.config inlines nothing", async () => {
    const { readFileSync } = await import("node:fs");
    const path = await import("node:path");
    const web = path.resolve(__dirname, "../../../apps/web");
    expect(readFileSync(path.join(web, "lib/algolia.ts"), "utf8")).not.toMatch(/process\.env\.NEXT_PUBLIC_ALGOLIA/);
    const component = readFileSync(path.join(web, "components/search/search-experience.tsx"), "utf8");
    expect(component).not.toMatch(/process\.env/);
    expect(readFileSync(path.join(web, "next.config.ts"), "utf8")).not.toMatch(/^\s*env\s*:/m);
  });
});
