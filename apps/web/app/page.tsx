import { SearchExperience } from "@/components/search/search-experience";
import { Catalogue } from "@/components/catalogue";
import { searchConfig } from "@/lib/algolia";

// Per request: the Algolia secrets are the Worker's, read at render (a
// build-time prerender would freeze the build's answer in), and the catalogue
// is read from Postgres while search is not connected.
export const dynamic = "force-dynamic";

export default function Home() {
  const config = searchConfig();
  return (
    <div className="flex min-h-full flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
        <span className="font-mono text-sm">
          <span className="text-algolia-text">algolia</span>
          <span className="mx-0.5 text-zinc-500">×</span>
          <span className="text-supabase">supabase</span>
          <span className="mx-0.5 text-zinc-500">×</span>
          <span className="text-zinc-300">cloudflare</span>
        </span>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 pb-24">
        <section className="py-14 text-center sm:py-20">
          <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-border-subtle bg-card px-3 py-1 text-xs font-medium text-zinc-400">
            <span className="size-1.5 rounded-full bg-supabase" />
            Open-source search starter
          </p>
          <h1 className="mx-auto max-w-3xl text-balance text-4xl font-semibold leading-tight tracking-tight text-zinc-400 sm:text-5xl">
            <span className="text-algolia-text font-bold">Algolia</span> finds it.{" "}
            <span className="text-supabase font-bold">Supabase</span> stores
            it. <span className="font-bold text-zinc-50">Cloudflare</span>{' '}
            wires them.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-balance text-base leading-relaxed text-zinc-400">
            A production-ready template for typo-tolerant, instant search over
            your Postgres data, indexed to{" "}
            <span className="text-algolia-text">Algolia</span>, deployed on
            Cloudflare.
          </p>
        </section>

        <div data-search={config ? "connected" : "not-connected"}>
          <SearchExperience config={config} />
          {!config && <Catalogue />}
        </div>
      </main>

      <footer className="border-t border-border-subtle">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-2 px-6 py-6 text-xs text-zinc-500 sm:flex-row">
          <span className="font-mono">
            <span className="text-algolia-text">Algolia</span>{" "}
            <span className="text-zinc-600">·</span>{" "}
            <span className="text-supabase">Supabase</span>{" "}
            <span className="text-zinc-600">·</span>{" "}
            <span className="text-zinc-300">Cloudflare</span>
          </span>
          <span>Built as an open-source starter template.</span>
        </div>
      </footer>
    </div>
  );
}
