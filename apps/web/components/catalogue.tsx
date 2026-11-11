import Link from "next/link";
import { listProducts, type CatalogueRow } from "@/lib/products";

// Not upstream's. Until Algolia is connected the template's home page is its
// "search activates once…" notice and nothing else; this lists the catalogue
// under it, read straight from Postgres through the HYPERDRIVE binding, in the
// search hits' own cards — so a product goes live showing its data, and every
// card opens the product page as a hit does. It shows only what the connector's
// transformation (demo/transform.js) would index: never the database-only
// fields. Once the Algolia secrets are set the page renders InstantSearch
// instead, and this is not rendered at all.
const price = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

function missingTable(error: unknown): boolean {
  return error instanceof Error && /relation "products" does not exist/.test(error.message);
}

export async function Catalogue() {
  let rows: CatalogueRow[];
  try {
    rows = await listProducts();
  } catch (error) {
    // The migrations create the table before the Worker serves (db-migrate);
    // a local database that was never migrated says so instead of failing.
    if (!missingTable(error)) throw error;
    return (
      <div
        data-schema="missing"
        className="mx-auto mt-6 w-full max-w-2xl rounded-xl border border-border-subtle bg-card p-5 text-sm text-zinc-400"
      >
        The <code className="text-zinc-200">products</code> table is not there
        yet — its migrations have not run. Locally:{" "}
        <code className="text-zinc-200">pnpm --filter @app/web db:migrate</code>.
      </div>
    );
  }

  return (
    <section className="mt-10">
      <p className="mb-4 text-sm text-zinc-500">
        {rows.length.toLocaleString()} product{rows.length === 1 ? "" : "s"} ·
        read from <span className="text-supabase">Supabase</span> until search
        is connected
      </p>
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((p) => (
          <li key={p.id} className="list-none">
            <Link
              href={`/products/${p.id}`}
              className="group flex h-full flex-col overflow-hidden rounded-xl border border-border-subtle bg-card transition-colors duration-200 hover:border-supabase focus-visible:border-supabase focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-supabase/40"
            >
              <div className="relative aspect-square overflow-hidden bg-white/5">
                {p.image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.image_url}
                    alt={p.name}
                    loading="lazy"
                    className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                )}
                {p.rating != null && (
                  <span className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-medium text-zinc-100 backdrop-blur">
                    <span className="text-supabase">★</span>
                    {Number(p.rating).toFixed(1)}
                  </span>
                )}
                {!Number(p.quantity) && (
                  <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-medium text-zinc-100 backdrop-blur">
                    Out of stock
                  </span>
                )}
              </div>
              <div className="flex flex-1 flex-col gap-2 p-4">
                <h3 className="line-clamp-1 text-sm font-semibold text-zinc-100">{p.name}</h3>
                <p className="line-clamp-2 text-xs leading-relaxed text-zinc-400">{p.description}</p>
                <div className="mt-auto flex items-center justify-between pt-2">
                  <span className="rounded-full bg-white/5 px-2.5 py-1 text-[11px] font-medium text-zinc-400">
                    {p.category}
                  </span>
                  <span className="text-sm font-semibold text-zinc-100">{price.format(Number(p.price))}</span>
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
