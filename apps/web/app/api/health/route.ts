import { query } from "@/lib/db";
import { searchConfig } from "@/lib/algolia";

// Not upstream's: the deploy's smoke check and the bootstrap's probes read
// this. The home page proves the Worker deployed; this proves what a page
// render cannot say on its own — the HYPERDRIVE binding names a real config,
// Hyperdrive reaches the Supabase database, and db-migrate applied the schema:
// the `products` table exists, with row-level security on. `search` says
// whether the Algolia secrets reached the Worker (never their values); a
// product goes live without them, so it is not part of `ok`.
export const dynamic = "force-dynamic";

export async function GET() {
  const headers = { "cache-control": "no-store" };
  const search = searchConfig() ? "connected" : "not connected";
  try {
    const [row] = await query<{ products: string | null; rls: boolean }>(
      `select to_regclass('public.products')::text as products,
              coalesce((select relrowsecurity from pg_class
                         where oid = to_regclass('public.products')), false) as rls`,
    );
    const ok = Boolean(row?.products) && row?.rls === true;
    return Response.json(
      { ok, database: "reachable", schema: ok ? "migrated" : "missing", search },
      { status: ok ? 200 : 503, headers },
    );
  } catch (error) {
    console.error("health: database check failed", error);
    return Response.json({ ok: false, database: "unreachable", search }, { status: 503, headers });
  }
}
