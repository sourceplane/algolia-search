import { beforeEach, describe, expect, it, vi } from "vitest";

// /api/health is what the deploy's smoke and the bootstrap's probes read: 200
// only when the database answers through the binding and the migrations have
// run — the products table exists, with row-level security on. `search` says
// whether the Algolia secrets reached the Worker; a product goes live without
// them, so it is not part of `ok`.
let answer: () => Promise<unknown[]>;
let connected = false;
vi.mock("@/lib/db", () => ({ query: async () => answer() }));
vi.mock("@/lib/algolia", () => ({
  searchConfig: () => (connected ? { appId: "APP", searchApiKey: "secret-search-key" } : null),
}));

beforeEach(() => {
  connected = false;
  vi.spyOn(console, "error").mockImplementation(() => {});
});

async function health() {
  const { GET } = await import("@/app/api/health/route");
  const res = await GET();
  const text = await res.text();
  return { status: res.status, body: JSON.parse(text) as Record<string, unknown>, text, cache: res.headers.get("cache-control") };
}

describe("GET /api/health (app/api/health/route.ts)", () => {
  it("is ok when the table exists with row-level security, search not connected yet", async () => {
    answer = async () => [{ products: "products", rls: true }];
    const r = await health();
    expect({ status: r.status, body: r.body, cache: r.cache }).toEqual({
      status: 200,
      body: { ok: true, database: "reachable", schema: "migrated", search: "not connected" },
      cache: "no-store",
    });
  });

  it("says search is connected, never with the key", async () => {
    connected = true;
    answer = async () => [{ products: "products", rls: true }];
    const r = await health();
    expect(r.body.search).toBe("connected");
    expect(r.text).not.toContain("secret-search-key");
    expect(r.text).not.toContain("APP");
  });

  it("is 503 when the migrations have not run", async () => {
    answer = async () => [{ products: null, rls: false }];
    const r = await health();
    expect(r.status).toBe(503);
    expect(r.body).toEqual({ ok: false, database: "reachable", schema: "missing", search: "not connected" });
  });

  it("is 503 when the table is there without row-level security", async () => {
    answer = async () => [{ products: "products", rls: false }];
    const r = await health();
    expect(r.status).toBe(503);
    expect(r.body.schema).toBe("missing");
  });

  it("is 503 when the database is unreachable", async () => {
    answer = async () => {
      throw new Error("connection refused");
    };
    const r = await health();
    expect(r.status).toBe(503);
    expect(r.body).toEqual({ ok: false, database: "unreachable", search: "not connected" });
  });
});
