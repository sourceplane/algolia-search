import { notFound } from "next/navigation";
import Link from "next/link";
import { getProduct } from "@/lib/products";

const price = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

function formatPrice(value: string | null): string {
  if (value == null) return "—";
  const n = Number(value);
  return Number.isNaN(n) ? value : price.format(n);
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const product = await getProduct(Number(id));
  if (!product) notFound();

  const dbOnly = [
    { term: "Cost price", value: formatPrice(product.cost_price) },
    { term: "Supplier", value: product.supplier_id ?? "—" },
    { term: "Stock location", value: product.stock_location ?? "—" },
    { term: "Internal notes", value: product.internal_notes ?? "—" },
  ];

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8 sm:py-12">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm text-zinc-400 transition-colors hover:text-zinc-100"
      >
        <span aria-hidden>←</span> Back to search
      </Link>

      <article className="mt-8 grid gap-8 lg:grid-cols-2 lg:gap-12">
        <div className="overflow-hidden rounded-xl border border-border-subtle bg-card">
          <div className="relative aspect-square bg-white/5">
            {product.image_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={product.image_url}
                alt={product.name}
                className="size-full object-cover"
              />
            )}
          </div>
        </div>

        <div className="flex flex-col">
          <span className="w-fit rounded-full bg-white/5 px-2.5 py-1 text-[11px] font-medium text-zinc-400">
            {product.category}
          </span>
          <h1 className="mt-4 text-balance text-3xl font-semibold tracking-tight text-zinc-50 sm:text-4xl">
            {product.name}
          </h1>
          <div className="mt-3 flex items-center gap-4">
            <span className="text-2xl font-semibold text-zinc-100">
              {formatPrice(product.price)}
            </span>
            {product.rating != null && (
              <span className="flex items-center gap-1 text-sm text-zinc-400">
                <span className="text-supabase">★</span>
                {Number(product.rating).toFixed(1)}
              </span>
            )}
            <span className="text-sm text-zinc-400">
              {Number(product.quantity) > 0
                ? `In stock: ${product.quantity}`
                : "Out of stock"}
            </span>
          </div>
          <p className="mt-5 text-base leading-relaxed text-zinc-400">
            {product.description}
          </p>

          <section className="mt-8 rounded-xl border border-supabase/40 bg-supabase/[0.03] p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-supabase">
              <span className="size-1.5 rounded-full bg-supabase" />
              Only in the database
            </h2>
            <p className="mt-2 text-xs leading-relaxed text-zinc-500">
              These fields live in Supabase but never reach the Algolia index —
              the connector transformation strips them.
            </p>
            <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
              {dbOnly.map(({ term, value }) => (
                <div key={term}>
                  <dt className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                    {term}
                  </dt>
                  <dd className="mt-0.5 text-sm text-zinc-200">{value}</dd>
                </div>
              ))}
            </dl>
          </section>
        </div>
      </article>
    </main>
  );
}
