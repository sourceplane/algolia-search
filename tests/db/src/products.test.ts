import { beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import * as path from "node:path";
import { manifest } from "@saas/db/manifest";

// The products table and its demo rows as the migrations leave them, on a real
// Postgres in process (PGlite). Upstream had one file, demo/seed.sql, pasted
// into the Supabase SQL Editor: its CREATE TABLE is migration 010 and its
// twenty upserts are 030. These hold the two to that file byte for byte, and
// the connector's transformation (apps/web/demo/transform.js) to what the
// product page says never reaches the index.
const migrationsDir = path.resolve(__dirname, "../../../packages/db/src/migrations");
const sqlOf = (rel: string) => readFileSync(path.join(migrationsDir, rel), "utf8");
const transformJs = path.resolve(__dirname, "../../../apps/web/demo/transform.js");

// algolia/algolia-supabase-vercel-starter @ da3f27b, demo/seed.sql: its sha256,
// and the three comment lines it opens with (written for the SQL Editor).
const UPSTREAM_SEED_SHA256 = "7012a7606fd0b0ba90ca0d7ab3c2f45a5588da6a497b15b387d937bb93305d5b";
const UPSTREAM_SEED_HEADER =
  "-- Seed data for the Algolia × Supabase starter.\n" +
  "-- Paste this whole file into the Supabase SQL Editor and run it.\n" +
  "-- Idempotent: re-running upserts the same 20 products, never duplicates.\n\n";

async function migrated(): Promise<PGlite> {
  const db = new PGlite();
  for (const entry of manifest.migrations) await db.exec(sqlOf(entry.path));
  return db;
}

type Transform = (record: Record<string, unknown>, helper: unknown) => Promise<Record<string, unknown>>;
function transform(): Transform {
  // The file is pasted into Algolia's dashboard as is: a bare function, no export.
  return new Function(`${readFileSync(transformJs, "utf8")}\nreturn transform;`)() as Transform;
}

describe("migrations 010 and 030 against upstream's demo/seed.sql", () => {
  it("are its CREATE TABLE and its twenty upserts, byte for byte", () => {
    const m10 = sqlOf("010_products/up.sql");
    const m30 = sqlOf("030_demo_products/up.sql");
    const create = m10.slice(m10.indexOf("create table if not exists products ("));
    const inserts = m30.slice(m30.indexOf("insert into products"));
    const rebuilt = UPSTREAM_SEED_HEADER + create + "\n" + inserts;
    expect(createHash("sha256").update(rebuilt).digest("hex")).toBe(UPSTREAM_SEED_SHA256);
  });
});

describe("the products table (after every migration)", () => {
  let db: PGlite;
  beforeAll(async () => {
    db = await migrated();
  }, 60_000);

  it("has upstream's columns", async () => {
    const { rows } = await db.query<{ column_name: string; data_type: string; is_nullable: string }>(
      `select column_name, data_type, is_nullable from information_schema.columns
        where table_schema = 'public' and table_name = 'products' order by ordinal_position`,
    );
    expect(rows.map((r) => `${r.column_name} ${r.data_type} ${r.is_nullable}`)).toEqual([
      "id integer NO",
      "name text NO",
      "description text NO",
      "category text NO",
      "price numeric NO",
      "image_url text YES",
      "rating numeric YES",
      "cost_price numeric YES",
      "supplier_id text YES",
      "internal_notes text YES",
      "stock_location text YES",
      "quantity integer NO",
      "updated_at timestamp with time zone NO",
    ]);
  });

  it("holds the twenty demo products, ids 1 to 20", async () => {
    const { rows } = await db.query<{ n: number; lo: number; hi: number }>(
      "select count(*)::int as n, min(id) as lo, max(id) as hi from products",
    );
    expect(rows[0]).toEqual({ n: 20, lo: 1, hi: 20 });
  });

  it("keeps exactly those twenty however often 030 is applied", async () => {
    await db.exec(sqlOf("030_demo_products/up.sql"));
    await db.exec(sqlOf("030_demo_products/up.sql"));
    const { rows } = await db.query<{ n: number }>("select count(*)::int as n from products");
    expect(rows[0]!.n).toBe(20);
  });

  it("applies the table migration again without harm", async () => {
    await db.exec(sqlOf("010_products/up.sql"));
    const { rows } = await db.query<{ n: number }>("select count(*)::int as n from products");
    expect(rows[0]!.n).toBe(20);
  });

  it("gives the connector's transformation every row, and it drops the database-only fields", async () => {
    const fn = transform();
    const { rows } = await db.query<Record<string, unknown>>("select * from products order by id");
    for (const row of rows) {
      const record = await fn(row, {});
      expect(Object.keys(record).sort()).toEqual(
        ["category", "description", "image_url", "in_stock", "name", "objectID", "price", "quantity", "rating"].sort(),
      );
      expect(record.objectID).toBe(String(row.id));
      expect(record.in_stock).toBe(Number(row.quantity) > 0);
      for (const internal of ["cost_price", "supplier_id", "internal_notes", "stock_location"]) {
        expect(record).not.toHaveProperty(internal);
      }
    }
    // Not vacuous: the dataset has both sides of the stock toggle.
    const stock = await Promise.all(rows.map((r) => fn(r, {})));
    expect(new Set(stock.map((r) => r.in_stock))).toEqual(new Set([true, false]));
  });
});
