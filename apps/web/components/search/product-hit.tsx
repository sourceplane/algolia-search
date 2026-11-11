import Link from "next/link";
import { Highlight } from "react-instantsearch";
import type { Hit } from "instantsearch.js";

type ProductRecord = {
  name: string;
  description: string;
  category: string;
  price: number;
  image_url: string;
  rating: number;
  quantity: number;
};

const price = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

export function ProductHit({ hit }: { hit: Hit<ProductRecord> }) {
  return (
    <Link
      href={`/products/${hit.objectID}`}
      className="group flex h-full flex-col overflow-hidden rounded-xl border border-border-subtle bg-card transition-colors duration-200 hover:border-supabase focus-visible:border-supabase focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-supabase/40"
    >
      <div className="relative aspect-square overflow-hidden bg-white/5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={hit.image_url}
          alt={hit.name}
          loading="lazy"
          className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
        <span className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-medium text-zinc-100 backdrop-blur">
          <span className="text-supabase">★</span>
          {hit.rating.toFixed(1)}
        </span>
        {!hit.quantity && (
          <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-medium text-zinc-100 backdrop-blur">
            Out of stock
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="line-clamp-1 text-sm font-semibold text-zinc-100">
          <Highlight attribute="name" hit={hit} />
        </h3>
        <p className="line-clamp-2 text-xs leading-relaxed text-zinc-400">
          <Highlight attribute="description" hit={hit} />
        </p>
        <div className="mt-auto flex items-center justify-between pt-2">
          <span className="rounded-full bg-white/5 px-2.5 py-1 text-[11px] font-medium text-zinc-400">
            {hit.category}
          </span>
          <span className="text-sm font-semibold text-zinc-100">
            {price.format(hit.price)}
          </span>
        </div>
      </div>
    </Link>
  );
}
