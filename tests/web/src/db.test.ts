import { beforeEach, describe, expect, it, vi } from "vitest";

// lib/db.ts: upstream's `query(text, params)`, unchanged at every call site.
// On the Worker the connection string is the HYPERDRIVE binding's and each
// request's ExecutionContext keeps one connected pg Client; without a
// Cloudflare context it is upstream's own pool over POSTGRES_URL.
type Ctx = { env: { HYPERDRIVE?: { connectionString: string } }; ctx: object };
let cf: Ctx | null = null;
vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: () => {
    if (!cf) throw new Error("no Cloudflare context");
    return cf;
  },
}));

const made: { kind: "client" | "pool"; config: Record<string, unknown>; queries: unknown[][]; connects: number }[] = [];
let failConnect = 0;
vi.mock("pg", () => {
  class Client {
    record: (typeof made)[number];
    constructor(config: Record<string, unknown>) {
      this.record = { kind: "client", config, queries: [], connects: 0 };
      made.push(this.record);
    }
    async connect() {
      this.record.connects += 1;
      if (failConnect > 0) {
        failConnect -= 1;
        throw new Error("connection refused");
      }
    }
    async query(text: string, params: unknown[]) {
      this.record.queries.push([text, params]);
      return { rows: [{ text }] };
    }
  }
  class Pool {
    record: (typeof made)[number];
    constructor(config: Record<string, unknown>) {
      this.record = { kind: "pool", config, queries: [], connects: 0 };
      made.push(this.record);
    }
    async query(text: string, params: unknown[]) {
      this.record.queries.push([text, params]);
      return { rows: [{ text }] };
    }
  }
  return { Client, Pool };
});

beforeEach(() => {
  made.length = 0;
  failConnect = 0;
  cf = null;
  delete process.env.POSTGRES_URL;
  vi.resetModules();
});

const hyperdrive = { HYPERDRIVE: { connectionString: "postgres://user:pw@hyperdrive.local:5432/db" } };

describe("query (lib/db.ts)", () => {
  it("connects a pg Client through the Hyperdrive binding, with no ssl override", async () => {
    cf = { env: hyperdrive, ctx: {} };
    const { query } = await import("@/lib/db");
    expect(await query("select 1", [7])).toEqual([{ text: "select 1" }]);
    expect(made).toHaveLength(1);
    expect(made[0]).toMatchObject({ kind: "client", config: { connectionString: hyperdrive.HYPERDRIVE.connectionString } });
    expect(made[0]!.config).not.toHaveProperty("ssl");
    expect(made[0]!.queries).toEqual([["select 1", [7]]]);
  });

  it("keeps one client per request, connected once, and a new one for the next", async () => {
    const first = {};
    cf = { env: hyperdrive, ctx: first };
    const { query } = await import("@/lib/db");
    await Promise.all([query("a"), query("b")]);
    expect(made).toHaveLength(1);
    expect(made[0]!.connects).toBe(1);
    expect(made[0]!.queries.map((q) => q[0])).toEqual(["a", "b"]);
    cf = { env: hyperdrive, ctx: {} };
    await query("c");
    expect(made).toHaveLength(2);
    cf = { env: hyperdrive, ctx: first };
    await query("d");
    expect(made).toHaveLength(2);
    expect(made[0]!.queries.map((q) => q[0])).toEqual(["a", "b", "d"]);
  });

  it("does not keep a client whose connect failed: the request's next query connects again", async () => {
    cf = { env: hyperdrive, ctx: {} };
    failConnect = 1;
    const { query } = await import("@/lib/db");
    await expect(query("a")).rejects.toThrow("connection refused");
    await new Promise((r) => setTimeout(r, 0));
    expect(await query("b")).toEqual([{ text: "b" }]);
    expect(made).toHaveLength(2);
  });

  it("falls back to upstream's pool over POSTGRES_URL without a Cloudflare context", async () => {
    process.env.POSTGRES_URL = "postgres://u:p@db.supabase.co:6543/postgres?sslmode=require";
    const { query } = await import("@/lib/db");
    await query("select 2");
    await query("select 3");
    expect(made).toHaveLength(1);
    expect(made[0]).toMatchObject({
      kind: "pool",
      config: {
        connectionString: "postgres://u:p@db.supabase.co:6543/postgres",
        ssl: { rejectUnauthorized: false },
        max: 5,
      },
    });
  });
});
