import { createServer, type IncomingMessage, type Server } from "node:http";
import type { AddressInfo } from "node:net";

// An in-process stand-in for Algolia's search API: the multi-query endpoint
// the lite client calls (POST /1/indexes/*/queries), answering with hits,
// nbHits, facets and highlights over the records it is given, and honouring
// `query`, `facetFilters` and `numericFilters`. Every request is recorded
// with the application id and key it carried (headers or query string).
export type Indexed = {
  objectID: string;
  name: string;
  description: string;
  category: string;
  price: number;
  image_url: string | null;
  rating: number | null;
  quantity: number;
  in_stock: boolean;
};
export type Seen = { path: string; app: string | null; key: string | null; body: { requests?: Record<string, unknown>[] } };

function params(req: Record<string, unknown>): Record<string, unknown> {
  const p = req.params;
  if (typeof p === "string") {
    const out: Record<string, unknown> = { ...req };
    for (const [k, v] of new URLSearchParams(p)) {
      try {
        out[k] = JSON.parse(v);
      } catch {
        out[k] = v;
      }
    }
    return out;
  }
  return { ...req, ...(p as object | undefined) };
}

function alts(f: unknown): string[] {
  return Array.isArray(f) ? (f as string[]) : [String(f)];
}

function search(records: Indexed[], req: Record<string, unknown>) {
  const r = params(req);
  const q = String(r.query ?? "").toLowerCase();
  const words = q.split(/\s+/).filter(Boolean);
  const pre = String(r.highlightPreTag ?? "<em>");
  const post = String(r.highlightPostTag ?? "</em>");
  const hits = records.filter((rec) => {
    const hay = `${rec.name} ${rec.description} ${rec.category}`.toLowerCase();
    if (!words.every((w) => hay.includes(w))) return false;
    for (const f of (r.facetFilters as unknown[]) ?? []) {
      const ok = alts(f).some((a) => {
        const [k, v] = a.split(":");
        return String(rec[k as keyof Indexed]).toLowerCase() === String(v).toLowerCase();
      });
      if (!ok) return false;
    }
    for (const f of (r.numericFilters as unknown[]) ?? []) {
      const ok = alts(f).some((a) => {
        const m = /^\s*([a-z_]+)\s*(<=|>=|<|>|=)\s*(-?[\d.]+)\s*$/.exec(a);
        if (!m) return false;
        const v = rec[m[1] as keyof Indexed] as number | null;
        const n = Number(m[3]);
        if (v == null) return false;
        return { "<=": v <= n, ">=": v >= n, "<": v < n, ">": v > n, "=": v === n }[m[2] as "<="];
      });
      if (!ok) return false;
    }
    return true;
  });
  // `facets` is a list, or one name (a toggle's own facet request sends one).
  const asked = r.facets == null ? [] : Array.isArray(r.facets) ? (r.facets as string[]) : [String(r.facets)];
  const facetNames = asked.includes("*") ? ["category", "price", "rating", "in_stock"] : asked.filter((f) => ["category", "price", "rating", "in_stock"].includes(f));
  const facets: Record<string, Record<string, number>> = {};
  for (const f of facetNames) {
    facets[f] = {};
    for (const h of hits) {
      const v = h[f as keyof Indexed];
      if (v == null) continue;
      facets[f][String(v)] = (facets[f][String(v)] ?? 0) + 1;
    }
  }
  const mark = (s: string) =>
    words.reduce((acc, w) => acc.replace(new RegExp(w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), (m) => `${pre}${m}${post}`), s);
  return {
    hits: hits.map((h) => ({
      ...h,
      _highlightResult: Object.fromEntries(
        (["name", "description", "category"] as const).map((k) => [k, { value: mark(h[k]), matchLevel: words.length ? "full" : "none", matchedWords: words }]),
      ),
    })),
    nbHits: hits.length,
    page: 0,
    nbPages: 1,
    hitsPerPage: 20,
    processingTimeMS: 1,
    exhaustiveNbHits: true,
    query: q,
    params: "",
    index: String(r.indexName ?? "products"),
    facets,
  };
}

async function read(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

export async function fakeAlgolia(records: Indexed[]): Promise<{ url: string; seen: Seen[]; close: () => Promise<void> }> {
  const seen: Seen[] = [];
  const server: Server = createServer(async (req, res) => {
    const cors = {
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "*",
      "access-control-allow-methods": "GET, POST, OPTIONS",
    };
    if (req.method === "OPTIONS") {
      res.writeHead(204, cors).end();
      return;
    }
    const u = new URL(req.url ?? "/", "http://stand-in");
    const text = await read(req);
    const body = text ? JSON.parse(text) : {};
    seen.push({
      path: u.pathname,
      app: (req.headers["x-algolia-application-id"] as string) ?? u.searchParams.get("x-algolia-application-id"),
      key: (req.headers["x-algolia-api-key"] as string) ?? u.searchParams.get("x-algolia-api-key"),
      body,
    });
    if (req.method !== "POST" || !/^\/1\/indexes\/[^/]+\/queries$/.test(u.pathname)) {
      res.writeHead(404, { ...cors, "content-type": "application/json" }).end('{"message":"not found"}');
      return;
    }
    const out = JSON.stringify({ results: (body.requests ?? []).map((r: Record<string, unknown>) => search(records, r)) });
    res.writeHead(200, { ...cors, "content-type": "application/json; charset=utf-8" }).end(out);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}`,
    seen,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}
