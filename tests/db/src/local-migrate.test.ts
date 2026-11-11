import { describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
// `pnpm --filter @app/web db:migrate`: the schema and the demo products into a
// LOCAL database, from the very files db-migrate applies to stage and prod.
import { connection, migrate } from "../../../apps/web/scripts/migrate.mjs";

// pg's `query`, over PGlite: a statement with parameters runs on the extended
// protocol, one without on the simple protocol (a file runs whole), as pg does.
function client(db: PGlite, failOn?: RegExp) {
  return {
    async query(text: string, params?: unknown[]) {
      if (failOn?.test(text)) throw new Error("boom");
      if (params) return db.query<Record<string, unknown>>(text, params);
      const results = await db.exec(text);
      return { rows: (results.at(-1)?.rows ?? []) as Record<string, unknown>[] };
    },
  };
}
const count = async (db: PGlite, sql: string) => (await db.query<{ n: number }>(sql)).rows[0]!.n;

describe("pnpm db:migrate (apps/web/scripts/migrate.mjs)", () => {
  it("applies the app migrations in order, keeping its ledger out of public", async () => {
    const db = new PGlite();
    const lines: string[] = [];
    expect(await migrate(client(db), (l) => lines.push(l))).toBe(3);
    expect(lines).toEqual(["applied: 010_products", "applied: 020_row_level_security", "applied: 030_demo_products"]);
    expect(await count(db, "select count(*)::int as n from products")).toBe(20);
    expect(await count(db, "select count(*)::int as n from local_migrations.applied")).toBe(3);
    const publicTables = await db.query<{ relname: string }>(
      `select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind in ('r', 'p') order by 1`,
    );
    expect(publicTables.rows.map((r) => r.relname)).toEqual(["products"]);
  }, 60_000);

  it("is up to date the second time, and writes nothing", async () => {
    const db = new PGlite();
    await migrate(client(db), () => {});
    await db.exec("delete from products where id = 20");
    const lines: string[] = [];
    expect(await migrate(client(db), (l) => lines.push(l))).toBe(0);
    expect(lines).toEqual(["up to date"]);
    expect(await count(db, "select count(*)::int as n from products")).toBe(19);
  }, 60_000);

  it("stops on a file changed after it was applied", async () => {
    const db = new PGlite();
    await migrate(client(db), () => {});
    await db.exec("update local_migrations.applied set checksum = 'x' where id = '020_row_level_security'");
    await expect(migrate(client(db), () => {})).rejects.toThrow(/020_row_level_security changed after it was applied/);
  }, 60_000);

  it("rolls a failed migration back with its ledger row, and applies it on the next run", async () => {
    const db = new PGlite();
    await expect(migrate(client(db, /insert into products/), () => {})).rejects.toThrow("boom");
    expect(await count(db, "select count(*)::int as n from local_migrations.applied")).toBe(2);
    expect(await count(db, "select count(*)::int as n from products")).toBe(0);
    const lines: string[] = [];
    expect(await migrate(client(db), (l) => lines.push(l))).toBe(1);
    expect(lines).toEqual(["applied: 030_demo_products"]);
    expect(await count(db, "select count(*)::int as n from products")).toBe(20);
  }, 60_000);

  it("talks TLS to a remote database, as the app's pool does, and plain to a local one", () => {
    expect(connection("postgres://postgres:postgres@localhost:54322/postgres")).toEqual({
      connectionString: "postgres://postgres:postgres@localhost:54322/postgres",
    });
    expect(connection("postgres://u:p@db.abc.supabase.co:5432/postgres?sslmode=require")).toEqual({
      connectionString: "postgres://u:p@db.abc.supabase.co:5432/postgres",
      ssl: { rejectUnauthorized: false },
    });
  });
});
