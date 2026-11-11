"use client";

import { useMemo } from "react";
import { liteClient as algoliasearch } from "algoliasearch/lite";
import {
  Hits,
  InstantSearch,
  useNumericMenu,
  RefinementList,
  SearchBox,
  Stats,
  ToggleRefinement,
} from "react-instantsearch";
import { ProductHit } from "./product-hit";

// The Algolia application and search-only key arrive as props: the server page
// reads them from the Worker per request (lib/algolia.ts) instead of the build
// inlining NEXT_PUBLIC_ variables into this bundle, as the template did. `host`
// replaces Algolia's own search hosts when it is set (a stand-in, in tests).
type SearchConfig = { appId: string; searchApiKey: string; host?: string };

function hostsFor(host: string) {
  const url = new URL(host);
  return [
    {
      url: url.host,
      protocol: url.protocol === "http:" ? ("http" as const) : ("https" as const),
      accept: "read" as const,
    },
  ];
}

export function SearchExperience({ config }: { config: SearchConfig | null }) {
  // One client per config, stable across renders.
  const searchClient = useMemo(
    () =>
      config
        ? algoliasearch(
            config.appId,
            config.searchApiKey,
            config.host ? { hosts: hostsFor(config.host) } : undefined,
          )
        : null,
    [config],
  );

  if (!config || !searchClient) {
    return (
      <div className="mx-auto w-full max-w-2xl rounded-xl border border-border-subtle bg-card p-5 text-sm text-zinc-400">
        Search activates once the{" "}
        <span className="text-algolia-text">Algolia</span> secrets are set —
        store <code className="text-zinc-200">ALGOLIA_APP_ID</code> and{" "}
        <code className="text-zinc-200">ALGOLIA_SEARCH_API_KEY</code> as the
        product&apos;s secrets and redeploy.
      </div>
    );
  }

  return (
    <InstantSearch
      searchClient={searchClient}
      indexName="products"
      future={{ preserveSharedStateOnUnmount: true }}
    >

      <div className="mx-auto w-full max-w-2xl">
        <SearchBox
          placeholder="Try “headphones”…"
          autoFocus
          submitIconComponent={SearchIcon}
          resetIconComponent={ClearIcon}
          classNames={{
            root: "w-full",
            form: "relative",
            input:
              "w-full rounded-xl border border-border-subtle bg-card py-3.5 pl-11 pr-10 text-base text-zinc-100 placeholder:text-zinc-500 outline-none transition-colors focus:border-supabase focus:ring-2 focus:ring-supabase/30",
            submit: "absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500",
            reset:
              "absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-500 transition-colors hover:text-zinc-200",
            loadingIndicator: "hidden",
            submitIcon: "size-4",
            resetIcon: "size-3.5",
          }}
        />
      </div>

      <div className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-[200px_1fr]">
        <aside className="lg:sticky lg:top-8 lg:self-start space-y-4">
          <CategoryMenu />
          <PriceMenu />
          <RatingMenu />
          <InStockMenu />
        </aside>

        <section>
          <Stats
            classNames={{ root: "mb-4 text-sm text-zinc-500" }}
            translations={{
              rootElementText: ({ nbHits, processingTimeMS }) =>
                `${nbHits.toLocaleString()} result${
                  nbHits === 1 ? "" : "s"
                } · ${processingTimeMS}ms`,
            }}
          />
          <Hits
            hitComponent={ProductHit}
            classNames={{
              list: "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3",
              item: "list-none",
              emptyRoot: "py-16 text-center text-sm text-zinc-500",
            }}
          />
        </section>
      </div>
    </InstantSearch>
  );
}

function CategoryMenu() {
  return (
    <>
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
        Category
      </h2>
      <RefinementList
        attribute="category"
        classNames={{
          list: "flex flex-col gap-0.5",
          item: "list-none",
          label:
            "flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm text-zinc-400 transition-colors hover:bg-white/5 hover:text-zinc-200",
          selectedItem: "text-zinc-50",
          checkbox: "facet-checkbox size-4 rounded",
          labelText: "flex-1",
          count:
            "rounded-full bg-white/5 px-2 py-0.5 text-[11px] tabular-nums text-zinc-500",
        }}
      />
    </>
  );
}

function InStockMenu() {
  return (
    <>
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
        Available
      </h2>
      <ToggleRefinement
        attribute="in_stock"
        on={true}
        label="Hide out of stock"
        classNames={{
          root: "flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm text-zinc-400 transition-colors hover:bg-white/5 hover:text-zinc-200",
          label: "flex items-center gap-2.5",
        }}
      />
    </>
  );
}

function RatingMenu() {
  const { items, refine } = useNumericMenu({
    attribute: "rating",
    items: [
      { label: "All ratings" },
      { label: "★★★★ +", start: 4 },
      { label: "★★★ +", start: 3 },
      { label: "★★ +", start: 2 },
      { label: "★ +", start: 1 },
    ],
  });

  return (
    <>
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
        Rating
      </h2>
      <ul className="flex flex-col gap-0.5">
        {items.map((item) => (
          <li key={item.value}>
            <label className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm text-zinc-400">
              <input
                type="radio"
                name="rating"
                checked={item.isRefined}
                onChange={() => refine(item.value)}
                className="facet-checkbox size-4"
              />
              <span>{item.label}</span>
            </label>
          </li>
        ))}
      </ul>
    </>
  );
}

function PriceMenu() {
  const { items, refine } = useNumericMenu({
    attribute: "price",
    items: [
      { label: "All prices" },
      { label: "$0 - $50", start: 0, end: 49.99 },
      { label: "$50 - $100", start: 50, end: 99.99 },
      { label: "$100+", start: 100 },
    ],
  });
  return (
    <>
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
        Price
      </h2>
      <ul className="flex flex-col gap-0.5">
        {items.map((item) => (
          <li key={item.value}>
            <label className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm text-zinc-400">
              <input
                type="radio"
                name="price"
                checked={item.isRefined}
                onChange={() => refine(item.value)}
                className="facet-checkbox size-4"
              />
              <span>{item.label}</span>
            </label>
          </li>
        ))}
      </ul>
    </>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden className="size-4">
      <path
        d="M9 3a6 6 0 1 0 3.9 10.6l3.3 3.3a1 1 0 0 0 1.4-1.4l-3.3-3.3A6 6 0 0 0 9 3Zm-4 6a4 4 0 1 1 8 0 4 4 0 0 1-8 0Z"
        fill="currentColor"
      />
    </svg>
  );
}

function ClearIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden className="size-3.5">
      <path
        d="M5 5l10 10M15 5L5 15"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
