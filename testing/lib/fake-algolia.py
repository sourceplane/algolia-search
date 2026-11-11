#!/usr/bin/env python3
"""A local stand-in for Algolia's search API, for testing/e2e.test.sh.

    python3 fake-algolia.py <port> <demo-products.sql> <requests.log>

Serves the products the SQL file upserts (the product's own
030_demo_products migration) as the Algolia connector's transformation
(apps/web/demo/transform.js) would index them: objectID, name, description,
category, price, image_url, rating, quantity and in_stock — never the
database-only fields. Answers the multi-query endpoint the lite client calls
(POST /1/indexes/*/queries) with hits, nbHits, facets and highlights,
honouring query, facetFilters, numericFilters and the highlight tags
InstantSearch sends. CORS is open, so a page on another port can call it from
a browser. Every request is appended to <requests.log> as a JSON line (path,
application id, key, body), so the test can assert what the browser sent.
"""
import json
import re
import sys
import urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

FACETABLE = ("category", "price", "rating", "in_stock")


def parse_seed(path):
    text = open(path, encoding="utf-8").read()
    rows = []
    for m in re.finditer(r"insert into products \(([^)]*)\) values \((.*?)\)\non conflict", text, re.S):
        cols = [c.strip() for c in m.group(1).split(",")]
        vals, cur, i, s = [], "", 0, m.group(2)
        while i < len(s):
            ch = s[i]
            if ch == "'":
                j, buf = i + 1, ""
                while True:
                    if s[j] == "'" and j + 1 < len(s) and s[j + 1] == "'":
                        buf += "'"; j += 2; continue
                    if s[j] == "'":
                        break
                    buf += s[j]; j += 1
                vals.append(buf); i = j + 1
                while i < len(s) and s[i] in " ,":
                    i += 1
                continue
            j = s.find(",", i)
            j = len(s) if j < 0 else j
            tok = s[i:j].strip()
            vals.append(None if tok.lower() == "null" else float(tok) if "." in tok else int(tok))
            i = j + 1
            while i < len(s) and s[i] == " ":
                i += 1
        rows.append(dict(zip(cols, vals)))
    return rows


def transform(r):
    return {
        "objectID": str(r["id"]),
        "name": r["name"],
        "description": r["description"],
        "category": r["category"],
        "price": float(r["price"]),
        "image_url": r.get("image_url"),
        "rating": None if r.get("rating") is None else float(r["rating"]),
        "quantity": int(r["quantity"]),
        "in_stock": int(r["quantity"]) > 0,
    }


def matches_query(rec, q):
    words = [w for w in q.lower().split() if w]
    hay = " ".join(str(rec[k]) for k in ("name", "description", "category")).lower()
    return all(w in hay for w in words)


def facet_ok(rec, filters):
    # facetFilters: [["category:Audio","category:Home"], "in_stock:true"] — AND of ORs.
    for f in filters or []:
        alts = f if isinstance(f, list) else [f]
        ok = False
        for a in alts:
            neg = a.startswith("-")
            k, _, v = a.lstrip("-").partition(":")
            val = rec.get(k)
            hit = str(val).lower() == v.lower() if not isinstance(val, bool) else str(val).lower() == v.lower()
            ok = ok or (hit != neg)
        if not ok:
            return False
    return True


def numeric_ok(rec, filters):
    for f in filters or []:
        alts = f if isinstance(f, list) else [f]
        ok = False
        for a in alts:
            m = re.match(r"^\s*([a-z_]+)\s*(<=|>=|<|>|=|!=)\s*(-?[\d.]+)\s*$", a)
            if not m:
                continue
            k, op, n = m.group(1), m.group(2), float(m.group(3))
            v = rec.get(k)
            if v is None:
                continue
            ok = ok or {"<=": v <= n, ">=": v >= n, "<": v < n, ">": v > n, "=": v == n, "!=": v != n}[op]
        if not ok:
            return False
    return True


def highlight(value, q, pre, post):
    out = str(value)
    for w in sorted({w for w in q.split() if w}, key=len, reverse=True):
        out = re.sub(re.escape(w), lambda m: f"{pre}{m.group(0)}{post}", out, flags=re.I)
    return out


def as_params(req):
    p = req.get("params")
    if isinstance(p, str):
        d = {k: v[0] for k, v in urllib.parse.parse_qs(p, keep_blank_values=True).items()}
        for k in ("facetFilters", "numericFilters", "facets"):
            if k in d:
                try:
                    d[k] = json.loads(d[k])
                except ValueError:
                    d[k] = [d[k]]
        out = dict(req); out.pop("params"); out.update(d); return out
    if isinstance(p, dict):
        out = dict(req); out.pop("params"); out.update(p); return out
    return req


def search(records, req):
    r = as_params(req)
    q = r.get("query", "") or ""
    pre = r.get("highlightPreTag", "<em>"); post = r.get("highlightPostTag", "</em>")
    hits = [x for x in records if matches_query(x, q) and facet_ok(x, r.get("facetFilters")) and numeric_ok(x, r.get("numericFilters"))]
    facets_req = r.get("facets") or []
    if isinstance(facets_req, str):
        facets_req = [facets_req]
    names = FACETABLE if "*" in facets_req else [f for f in facets_req if f in FACETABLE]
    facets = {}
    for f in names:
        counts = {}
        for h in hits:
            v = h.get(f)
            if v is None:
                continue
            key = str(v).lower() if isinstance(v, bool) else (str(int(v)) if isinstance(v, float) and v.is_integer() else str(v))
            counts[key] = counts.get(key, 0) + 1
        facets[f] = counts
    per = int(r.get("hitsPerPage", 20) or 20); page = int(r.get("page", 0) or 0)
    shown = hits[page * per:(page + 1) * per]
    out_hits = []
    for h in shown:
        hh = dict(h)
        hh["_highlightResult"] = {k: {"value": highlight(h[k], q, pre, post), "matchLevel": "full" if q else "none", "matchedWords": q.split()} for k in ("name", "description", "category")}
        out_hits.append(hh)
    return {
        "hits": out_hits, "nbHits": len(hits), "page": page, "nbPages": max(1, -(-len(hits) // per)),
        "hitsPerPage": per, "processingTimeMS": 1, "exhaustiveNbHits": True, "query": q,
        "params": urllib.parse.urlencode({"query": q}), "index": r.get("indexName", "products"), "facets": facets,
    }


class Handler(BaseHTTPRequestHandler):
    records = []
    log = None

    def _cors(self):
        self.send_header("access-control-allow-origin", "*")
        self.send_header("access-control-allow-headers", "*")
        self.send_header("access-control-allow-methods", "GET, POST, OPTIONS")

    def do_OPTIONS(self):
        self.send_response(204); self._cors(); self.end_headers()

    def do_POST(self):
        n = int(self.headers.get("content-length") or 0)
        body = self.rfile.read(n).decode("utf-8") if n else "{}"
        u = urllib.parse.urlparse(self.path)
        qs = {k: v[0] for k, v in urllib.parse.parse_qs(u.query).items()}
        key = self.headers.get("x-algolia-api-key") or qs.get("x-algolia-api-key")
        app = self.headers.get("x-algolia-application-id") or qs.get("x-algolia-application-id")
        with open(self.log, "a") as fh:
            fh.write(json.dumps({"path": u.path, "app": app, "key": key, "body": body}) + "\n")
        if not re.match(r"^/1/indexes/[^/]+/queries$", u.path):
            self.send_response(404); self._cors(); self.end_headers(); self.wfile.write(b'{"message":"not found"}'); return
        try:
            data = json.loads(body)
        except ValueError:
            data = {}
        res = {"results": [search(self.records, rq) for rq in data.get("requests", [])]}
        out = json.dumps(res).encode()
        self.send_response(200); self._cors()
        self.send_header("content-type", "application/json; charset=utf-8")
        self.send_header("content-length", str(len(out))); self.end_headers(); self.wfile.write(out)

    def log_message(self, *a):
        pass


if __name__ == "__main__":
    port, seed, log = int(sys.argv[1]), sys.argv[2], sys.argv[3]
    Handler.records = [transform(r) for r in parse_seed(seed)]
    Handler.log = log
    print(f"fake algolia on 127.0.0.1:{port}, {len(Handler.records)} records", flush=True)
    ThreadingHTTPServer(("127.0.0.1", port), Handler).serve_forever()
