#!/usr/bin/env bash
# TIER 2 — the product a bootstrap produces builds, migrates, deploys (dry),
# serves its catalogue from Postgres, and searches it through Algolia in a real
# browser once the Algolia secrets are set.
#
# placement.test.sh proves the tree a bootstrap ends with is the right tree,
# and that its own plan converges in the right order. This proves it WORKS,
# by doing to it what its own pipelines will:
#
#   1. at the 01-product landing (the commit its PR merges), install with the
#      lockfile the product ships, render the wrangler fixture (which must
#      change nothing: the render is committed), typecheck, lint, test, build.
#      The landing itself is checked in the build box with `orun validate`
#      and `orun plan` alone (`checks: local`), and its PR runs `plan` alone
#      (an `orun/BASE-*` branch), so THIS is where a product those steps
#      refuse is caught: before the tag, not after a build has merged it;
#   2. a Postgres of its own on a random port, with Supabase's roles — the
#      database a Supabase project would be: `postgres` a login role WITHOUT
#      superuser or BYPASSRLS, `anon` and `authenticated` with the Data API's
#      default grants (testing/lib/local-postgres.sh) — and a stand-in for the
#      ONE Supabase Management API endpoint the migration runner calls
#      (testing/lib/fake-supabase-api.py), connected as `postgres`;
#   3. the db-migrate lane's own steps, rendered by `orun plan` for a push to
#      main and run IN THE TREE THE RUNNER STAGES for the job: install, build
#      @saas/db, apply — the `products` table, row-level security on every
#      table in `public`, the template's twenty demo products — then apply
#      again, which must apply nothing, and the pull-request profile's offline
#      plan. The catalogue exists before the app serves a single request;
#   4. the web lane's own steps for stage, rendered for a pull request (the
#      verify profile carries deploy-dry-run; the deploy profile does not) and
#      run in its staged job tree: install, `verify-app-structure` (the
#      committed wrangler.jsonc must exist BEFORE the build, in a tree with no
#      build output), `build-app` — which re-renders the config from the
#      stage wiring document it is handed, as the deploy does, with the
#      Algolia secrets in its environment as the lane resolves them, none of
#      which may reach the bundle — then `verify-build-output` and
#      `deploy-dry-run`; and `pnpm db:migrate`, the local migrator, over the
#      same database;
#   5. the built Worker under `wrangler dev`, its HYPERDRIVE binding pointed at
#      that Postgres (the binding stubbed to the local database, as Hyperdrive
#      would hand the Worker the Supabase one), WITHOUT the Algolia secrets — a
#      product as it is born: eight concurrent requests each listing the
#      twenty products; the component's OWN `smokeCommand`, verbatim; every
#      route the product promises (the page under the product's name, the
#      template's notice and the catalogue cards, each product page with its
#      database-only fields, the 404s, the favicon, and `/api/health`, which
#      only the Worker answers); a product added behind the app's back, read
#      on the next render;
#   6. the same Worker WITH the Algolia secrets (as Worker vars, as the deploy
#      pushes them as secrets) and a local stand-in for Algolia's search API
#      (testing/lib/fake-algolia.py, serving the demo products as the
#      connector's transformation indexes them): the page hands the browser
#      the application id and search-only key it was given and nothing else,
#      and a headless Chrome loads it, runs InstantSearch and renders the
#      twenty hits, their facets and the stock toggle from the stand-in;
#   7. the Data API's view of the same database: every table in `public` has
#      row-level security, and `anon` and `authenticated` — granted everything
#      Supabase grants them — read none of the products (the internal-only
#      fields among them) and can write none, while the app, as the table's
#      owner and nothing more, reads them all.
#
# What it cannot do is the platform's half: create the repository, mint the
# brokered tokens, create a real Supabase project and Hyperdrive config
# (Terraform is validated, not applied, in this repository), deploy for real,
# probe workers.dev, and connect a real Algolia application (its connector
# reads the Supabase project from Algolia's dashboard). That is a bootstrap
# against a workspace and an owner's step after it (BOOTSTRAP.md); everything
# short of it is here.
#
# Needs: orun, node, pnpm, python3 (+PyYAML), git, curl, psql and a
# PostgreSQL server install (initdb, pg_ctl), Google Chrome or Chromium (CHROME
# to name it; GitHub's ubuntu runners carry google-chrome), and the network for
# `pnpm install` (or a warm store). A few minutes: three installs, two builds.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
root="$(cd "$here/.." && pwd)"
# shellcheck source=lib/bootstrap.sh
source "$here/lib/bootstrap.sh"
# shellcheck source=lib/local-postgres.sh
source "$here/lib/local-postgres.sh"

for bin in orun node pnpm python3 git curl psql; do
  command -v "$bin" >/dev/null || { echo "e2e.test.sh needs $bin on PATH" >&2; exit 1; }
done
pg_bin >/dev/null || { echo "e2e.test.sh needs a PostgreSQL server install (initdb, pg_ctl)" >&2; exit 1; }
# The browser that runs InstantSearch in step 6. Required: the search is the
# template's whole point, and only a browser runs it.
chrome="${CHROME:-}"
if [ -z "$chrome" ]; then
  for c in google-chrome google-chrome-stable chromium chromium-browser \
           "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"; do
    if command -v "$c" >/dev/null 2>&1 || [ -x "$c" ]; then chrome="$c"; break; fi
  done
fi
[ -n "$chrome" ] || { echo "e2e.test.sh needs Google Chrome or Chromium (set CHROME to its binary)" >&2; exit 1; }

scratch="$(mktemp -d)"
pgdir="$(mktemp -d)"
dev_pid=""
api_pid=""
algolia_pid=""
# wrangler dev runs under pnpm, node and two workerd processes; a TERM to the
# first does not reach the rest, and waiting on it then never returns. So each
# server is started as its own process group (setsid) and the group stopped.
stop_group() {
  local pid="$1"
  [ -n "$pid" ] || return 0
  kill -TERM -- "-$pid" 2>/dev/null || true
  for _ in 1 2 3 4 5 6 7 8 9 10; do kill -0 -- "-$pid" 2>/dev/null || break; sleep 0.5; done
  kill -KILL -- "-$pid" 2>/dev/null || true
}
cleanup() {
  stop_group "$dev_pid"
  stop_group "$api_pid"
  stop_group "$algolia_pid"
  pg_down "$pgdir"
  [ -n "$pgdir" ] && [ -d "$pgdir" ] && rm -rf "$pgdir"
  [ -n "$scratch" ] && [ -d "$scratch" ] && rm -rf "$scratch"
}
trap cleanup EXIT
free_port() { python3 -c "import socket;s=socket.socket();s.bind(('127.0.0.1',0));print(s.getsockname()[1]);s.close()"; }
values="$here/fixtures/acme.json"
repo="$(python3 -c "import json,sys;print(json.load(open(sys.argv[1]))['reponame'])" "$values")"
export CI=1 WRANGLER_SEND_METRICS=false NEXT_TELEMETRY_DISABLED=1 TURBO_TELEMETRY_DISABLED=1

# The landing's own checks, step for step — what the product's Checks
# workflow ran on a pull request before the product carried ci.yml alone —
# run here at once on the whole tree.
LANDING_CHECKS=(
  "pnpm install --frozen-lockfile"
  "pnpm run wire:fixture"
  "pnpm typecheck"
  "pnpm lint"
  "pnpm test"
  "pnpm build"
)
checks() { # DIR LOG
  local dir="$1" log="$2" cmd
  for cmd in "${LANDING_CHECKS[@]}"; do
    echo "   \$ $cmd" | tee -a "$log"
    if ! (cd "$dir" && bash -c "$cmd") >> "$log" 2>&1; then
      echo "FAIL: \`$cmd\` failed in $dir" >&2; tail -40 "$log" >&2; return 1
    fi
  done
}

# One job of a plan, written out as the runner would run it: each `run:` step
# (the `use:` actions are setup-node and setup-pnpm, which this machine has)
# as a numbered script, the job's env, and the component path the steps run
# in. Steps are picked BY ID when given, else every `run:` step in order.
extract_job() { # PLAN JOB-ID OUT-DIR [STEP-ID…]
  python3 - "$@" <<'PY'
import json, pathlib, sys
plan, jid, out, *want = sys.argv[1:]
job = next((j for j in json.load(open(plan))["jobs"] if j["id"] == jid), None)
if job is None:
    sys.exit(f"the plan has no job {jid}")
out = pathlib.Path(out); out.mkdir(parents=True)
steps = [s for s in job["steps"] if s.get("run")]
if want:
    by = {s["id"]: s for s in steps}
    missing = [w for w in want if w not in by]
    if missing:
        sys.exit(f"{jid} has no step(s) {missing}")
    steps = [by[w] for w in want]
for i, s in enumerate(steps):
    (out / f"{i:02d}.sh").write_text(s["run"])
    (out / f"{i:02d}.id").write_text(s["id"])
(out / "path").write_text(job.get("path") or ".")
with (out / "env").open("w") as f:
    for k, v in (job.get("env") or {}).items():
        f.write(f"export {k}={json.dumps(v)}\n")
PY
}
run_job() { # STEPS-DIR WORK-TREE ENV LOG-PREFIX
  local steps="$1" work="$2" envname="$3" logp="$4" s id
  for s in "$steps"/[0-9][0-9].sh; do
    id="$(cat "${s%.sh}.id")"
    echo "   ▸ $id"
    if ! (cd "$work/$(cat "$steps/path")" && source "$steps/env" && export ORUN_ENVIRONMENT="$envname" \
          && bash -e "$s") > "$logp-$id.log" 2>&1; then
      echo "FAIL: the lane's $id step" >&2; tail -40 "$logp-$id.log" >&2; return 1
    fi
  done
}

echo "── the offline bootstrap (testing/lib/bootstrap.sh)"
tree="$scratch/$repo"
bootstrap_offline "$root" "$tree" "$values" "$scratch/logs" > "$scratch/bootstrap.log" 2>&1 || {
  echo "FAIL: the offline bootstrap stopped" >&2; tail -40 "$scratch/bootstrap.log" >&2; exit 1; }
echo "   2 phases placed and landed"

# ── 1. the product's own pull request ──────────────────────────────────────
echo "── 01-product's landing: install, the fixture render, typecheck, lint, test, build"
s01="$(git -C "$tree" rev-parse HEAD~1)"
at01="$scratch/at-01/$repo"
git -C "$tree" worktree add -q "$at01" "$s01"
checks "$at01" "$scratch/checks.log"
dirty="$(git -C "$at01" status --porcelain)"
[ -z "$dirty" ] || { echo "FAIL: the checks changed tracked files — the committed wrangler.jsonc is not the fixture render:" >&2; echo "$dirty" >&2; exit 1; }
echo "   the checks left the tree as committed (wire:fixture rendered the committed wrangler.jsonc)"

# ── 2. a database, and the one API the migration runner calls ──────────────
echo "── a local Postgres and the Supabase Management API stand-in"
pgurl="$(pg_up "$pgdir" "$(free_port)")" || { echo "FAIL: Postgres did not start" >&2; exit 1; }
api_port="$(free_port)"
ref="localproject"
setsid python3 "$here/lib/fake-supabase-api.py" "$api_port" "$pgurl" --ref "$ref" > "$scratch/api.log" 2>&1 < /dev/null &
api_pid=$!
for _ in $(seq 1 30); do curl -s -o /dev/null "http://127.0.0.1:$api_port/" && break; sleep 0.3; done
# Said out loud rather than found later as the runner's bare "fetch failed":
# the stand-in must be up, and stay up, before a lane is pointed at it.
api_up() { kill -0 "$api_pid" 2>/dev/null && curl -s -o /dev/null "http://127.0.0.1:$api_port/"; }
api_up || { echo "FAIL: the Management API stand-in is not answering on :$api_port" >&2; cat "$scratch/api.log" >&2; exit 1; }
echo "   $pgurl; the API on :$api_port"

# The two plans the lanes below run from, each in the product's own tree: a
# push to main at the 01-product commit (the db-migrate lane's APPLY profile),
# and a pull request over the finished product against an empty base (the web
# lane's VERIFY profile, which carries deploy-dry-run, and db-migrate's PLAN).
(cd "$at01" && orun plan --intent intent.yaml --trigger github-push-main --env stage --output "$scratch/plan-main.json") > "$scratch/plan-main.log" 2>&1 \
  || { echo "FAIL: orun plan (push to main)" >&2; tail -15 "$scratch/plan-main.log" >&2; exit 1; }
git -C "$tree" worktree remove --force "$at01"
mkdir -p "$scratch/pr"
git clone -q "$tree" "$scratch/pr/$repo"
prtree="$scratch/pr/$repo"
git -C "$prtree" checkout -q --orphan empty
git -C "$prtree" rm -rqf .
git -C "$prtree" -c user.email=t@example.invalid -c user.name=t commit -qm empty --allow-empty
git -C "$prtree" checkout -q main
(cd "$prtree" && orun plan --intent intent.yaml --trigger github-pull-request --base empty --head HEAD --env stage \
   --output "$scratch/plan-pr.json") > "$scratch/plan-pr.log" 2>&1 \
  || { echo "FAIL: orun plan (pull request)" >&2; tail -15 "$scratch/plan-pr.log" >&2; exit 1; }
# This tier runs the bootstrap floor, newer than the orun the product's CI
# pins, and both read the per-edge `modeRules`: on a pull request — which
# applies and deploys nothing — the infrastructure edges that order a push to
# main are advisory, so no lane waits on another. (placement.test.sh checks
# the push to main's order.)
python3 - "$scratch/plan-pr.json" <<'PY'
import json, sys
jobs = {j["component"]: j for j in json.load(open(sys.argv[1]))["jobs"] if j["environment"] == "stage"}
chain = ["supabase", "cloudflare-hyperdrive", "db-migrate", "web"]
for a, b in zip(chain, chain[1:]):
    ja, jb = jobs[a], jobs[b]
    if ja["id"] in (jb.get("dependsOn") or []) or ja["id"] not in (jb.get("advisoryDependsOn") or []):
        sys.exit(f"FAIL: on a pull request {b}@stage must name {a}@stage as advisory, not wait on it")
print("   pull request: " + " → ".join(chain) + ", every edge advisory")
PY

# ── 3. the db-migrate lane, in its staged job tree ─────────────────────────
echo "── the stage db-migrate lane: install, build @saas/db, apply — then apply again, and the PR's plan"
extract_job "$scratch/plan-main.json" db-migrate.stage.migrate "$scratch/steps-migrate" \
  install-dependencies build-db-package "Migration Apply"
extract_job "$scratch/plan-main.json" db-migrate.stage.migrate "$scratch/steps-migrate-again" "Migration Apply"
extract_job "$scratch/plan-pr.json" db-migrate.stage.migrate "$scratch/steps-migrate-plan" "Migration Plan"
# Staged from the fresh clone (a CI checkout: no build output, no
# node_modules); its migrations are the 01-product commit's, byte for byte.
mwork="$prtree/.orun/runs/e2e/db-migrate.stage.migrate/work"
python3 "$here/lib/stage-job.py" "$prtree" "$mwork"
# The component's secretEnv, as the lane resolves it: the supabase apply's
# published credentials and the brokered access token. SUPABASE_API_URL is
# the one value no lane has — it points the runner at the stand-in.
export SUPABASE_ACCESS_TOKEN=e2e-token SUPABASE_PROJECT_REF="$ref" SUPABASE_DB_PASSWORD=postgres \
       SUPABASE_DB_URL="$pgurl" SUPABASE_API_URL="http://127.0.0.1:$api_port"
api_up || { echo "FAIL: the Management API stand-in stopped before the lane ran" >&2; cat "$scratch/api.log" >&2; exit 1; }
run_job "$scratch/steps-migrate" "$mwork" stage "$scratch/migrate" \
  || { echo "   the stand-in's log:" >&2; tail -20 "$scratch/api.log" >&2; exit 1; }
applied() { python3 -c "import json,sys;t=open(sys.argv[1]).read();print(' '.join(json.loads(t[t.index('{'):t.rindex('}')+1])['applied']))" "$1"; }
want="000_control_baseline 010_products 020_row_level_security 030_demo_products"
[ "$(applied "$scratch/migrate-Migration Apply.log")" = "$want" ] \
  || { echo "FAIL: the first apply applied '$(applied "$scratch/migrate-Migration Apply.log")', not '$want'" >&2; exit 1; }
echo "   applied $want"
run_job "$scratch/steps-migrate-again" "$mwork" stage "$scratch/migrate-again"
[ -z "$(applied "$scratch/migrate-again-Migration Apply.log")" ] \
  || { echo "FAIL: a second apply applied '$(applied "$scratch/migrate-again-Migration Apply.log")'" >&2; exit 1; }
echo "   a second apply applied nothing (the ledger holds $(psql "$pgurl" -XAtc 'select count(*) from _migrations.applied') migrations)"
table="$(psql "$pgurl" -XAtc "select to_regclass('public.products') is not null, (select relrowsecurity from pg_class where oid = to_regclass('public.products')), pg_get_userbyid((select relowner from pg_class where oid = to_regclass('public.products'))), (select count(*) from products), (select count(*) from products where quantity = 0)")"
[ "${table%|*}" = "t|t|postgres|20" ] && [ "${table##*|}" -ge 1 ] \
  || { echo "FAIL: after the migrations products should exist, with RLS, owned by postgres, holding the 20 demo rows (some out of stock) — got '$table'" >&2; exit 1; }
echo "   products exists before the app serves: row-level security on, owned by postgres, the 20 demo products (${table##*|} out of stock)"
run_job "$scratch/steps-migrate-plan" "$mwork" stage "$scratch/migrate-plan"
[ "$(applied "$scratch/migrate-plan-Migration Plan.log")" = "$want" ] \
  || { echo "FAIL: the pull request's offline plan did not verify every migration" >&2; exit 1; }
echo "   the pull request's plan step verifies every migration's checksum offline"
unset SUPABASE_ACCESS_TOKEN SUPABASE_PROJECT_REF SUPABASE_DB_PASSWORD SUPABASE_DB_URL SUPABASE_API_URL
rm -rf "$mwork"

# ── 4. the web lane's steps, for stage ─────────────────────────────────────
echo "── the stage web lane: install, verify-app-structure, build-app, verify-build-output, deploy-dry-run"
extract_job "$scratch/plan-pr.json" web.stage.verify-deploy "$scratch/steps-web" \
  install-workspace-dependencies verify-app-structure build-app verify-build-output deploy-dry-run
work="$prtree/.orun/runs/e2e/web.stage.verify-deploy/work"
# The job's private tree, staged as orun stages it — no build output, no
# node_modules: under stack-tectonic 0.19.0 the job installs inside it.
python3 "$here/lib/stage-job.py" "$prtree" "$work"
[ ! -e "$work/apps/web/.open-next" ] && [ -f "$work/apps/web/wrangler.jsonc" ] \
  || { echo "FAIL: the staged tree is not a fresh checkout with the committed wrangler.jsonc" >&2; exit 1; }
echo "   staged: $(realpath --relative-to="$prtree" "$work") — no build output, the committed wrangler.jsonc"
# The stage wiring document, as the cloudflare-hyperdrive apply publishes it
# and the lane resolves it (secretEnv WIRING_CLOUDFLARE_HYPERDRIVE_STAGE) —
# and the Algolia secrets, as the lane resolves them once the owner stored
# them (optionalSecretEnv). The build must not carry them anywhere: they go to
# the Worker as secrets after it, and a verify lane (no Cloudflare credential)
# pushes nothing.
hd_id="e2e0000000000000000000000000c0de"
algolia_key="e2e-search-only-$(python3 -c 'import secrets;print(secrets.token_hex(8))')"
export WIRING_CLOUDFLARE_HYPERDRIVE_STAGE="{\"hyperdrive_id\":\"$hd_id\",\"hyperdrive_name\":\"stg-$repo-stage\"}"
export ALGOLIA_APP_ID="E2EBUILDAPP" ALGOLIA_SEARCH_API_KEY="$algolia_key"
unset CLOUDFLARE_API_TOKEN
run_job "$scratch/steps-web" "$work" stage "$scratch/web"
unset WIRING_CLOUDFLARE_HYPERDRIVE_STAGE ALGOLIA_APP_ID ALGOLIA_SEARCH_API_KEY
build_log="$(ls "$scratch"/web-build-app.log)"
grep -q '(Turbopack)' "$build_log" \
  || { echo "FAIL: the staged build did not run on Turbopack" >&2; grep -m3 'Next.js' "$build_log" >&2; exit 1; }
grep -q "\"id\": \"$hd_id\"" "$work/apps/web/wrangler.jsonc" \
  || { echo "FAIL: build-app did not re-render wrangler.jsonc from the stage wiring document" >&2; exit 1; }
[ "$(node -e 'const fs=require("fs");process.stdout.write(String(fs.readdirSync(process.argv[1]).length))' "$work/node_modules")" -gt 0 ] && [ ! -L "$work/node_modules" ] \
  || { echo "FAIL: the job's install did not land inside its own tree" >&2; exit 1; }
if grep -rlF "$algolia_key" "$work/apps/web/.open-next" "$work/apps/web/.next" > "$scratch/leaked.txt" 2>/dev/null; then
  echo "FAIL: the Algolia search key the lane held reached the build:" >&2; head -5 "$scratch/leaked.txt" >&2; exit 1
fi
grep -q 'worker-secrets: no Cloudflare credential in this job (a verify lane) — ALGOLIA_APP_ID, ALGOLIA_SEARCH_API_KEY reach' "$build_log" \
  || { echo "FAIL: build-app did not hand the Algolia secrets to worker-secrets.mjs (or pushed them from a verify lane)" >&2; grep -m3 'worker-secrets' "$build_log" >&2; exit 1; }
echo "   the staged build ran on Turbopack, inside its own tree, bound to the stage Hyperdrive id it was handed;"
echo "   the Algolia secrets it held are in no file it built, and a verify lane pushed them nowhere"

# ── 4b. the local migrator, over the same database ─────────────────────────
# `pnpm db:migrate` is how a product's owner migrates a LOCAL database: the
# very files db-migrate applied, recorded in its own ledger. Over a database
# db-migrate already migrated it must apply all three again harmlessly (they
# are idempotent: the demo rows are upserts), keep its ledger out of `public`
# (Supabase's Data API serves `public`), and find nothing to do the second
# time.
echo "── pnpm db:migrate over the migrated database"
(cd "$work/apps/web" && POSTGRES_URL="$pgurl" node scripts/migrate.mjs) > "$scratch/local-migrate.log" 2>&1 \
  || { echo "FAIL: pnpm db:migrate failed" >&2; cat "$scratch/local-migrate.log" >&2; exit 1; }
[ "$(grep -c '^applied: ' "$scratch/local-migrate.log")" = 3 ] && grep -q '^applied: 030_demo_products$' "$scratch/local-migrate.log" \
  || { echo "FAIL: pnpm db:migrate did not apply 010, 020 and 030" >&2; cat "$scratch/local-migrate.log" >&2; exit 1; }
(cd "$work/apps/web" && POSTGRES_URL="$pgurl" node scripts/migrate.mjs) > "$scratch/local-migrate-again.log" 2>&1
grep -qx 'up to date' "$scratch/local-migrate-again.log" \
  || { echo "FAIL: a second pnpm db:migrate was not up to date" >&2; cat "$scratch/local-migrate-again.log" >&2; exit 1; }
ledger="$(psql "$pgurl" -XAtc "select (select count(*) from local_migrations.applied), (select string_agg(c.relname, ',' order by c.relname) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind in ('r', 'p')), (select count(*) from products)")"
[ "$ledger" = "3|products|20" ] \
  || { echo "FAIL: after pnpm db:migrate the local ledger, public's tables and the products should be '3|products|20' — got '$ledger'" >&2; exit 1; }
echo "   applied all three again, recorded in schema local_migrations (public holds only products), then up to date; still 20 products"

# ── 5. serve it as it is born: no Algolia ──────────────────────────────────
serve() { # LOG [--var K:V …]
  local log="$1"; shift
  port="$(free_port)"
  (cd "$work/apps/web" && CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE="$pgurl" \
     exec setsid pnpm exec wrangler dev --config wrangler.jsonc --ip 127.0.0.1 --port "$port" \
     --inspector-port "$(free_port)" --name "$repo-web-stage" --show-interactive-dev-session=false "$@") > "$log" 2>&1 < /dev/null &
  dev_pid=$!
  url="http://127.0.0.1:$port"
  for _ in $(seq 1 90); do
    curl -s -o /dev/null "$url/api/health" && return 0
    kill -0 "$dev_pid" 2>/dev/null || { echo "FAIL: wrangler dev exited" >&2; tail -30 "$log" >&2; exit 1; }
    sleep 1
  done
  echo "FAIL: wrangler dev never answered" >&2; tail -30 "$log" >&2; exit 1
}
echo "── wrangler dev over the built Worker, its HYPERDRIVE binding on the local Postgres, no Algolia secrets"
[ ! -e "$work/apps/web/.dev.vars" ] || { echo "FAIL: the staged tree carries a .dev.vars" >&2; exit 1; }
serve "$scratch/dev.log"

echo "   ▸ eight concurrent requests to the page, each listing the catalogue"
python3 - "$url" <<'PY' || { echo "FAIL: the concurrent requests; wrangler dev said:" >&2; tail -40 "$scratch/dev.log" >&2; exit 1; }
import concurrent.futures, re, sys, urllib.request
base = sys.argv[1]
def get(_):
    # React's streamed render separates adjacent text nodes with `<!-- -->`.
    with urllib.request.urlopen(base + "/", timeout=120) as r:
        return r.status, r.read().decode().replace("<!-- -->", "")
with concurrent.futures.ThreadPoolExecutor(8) as pool:
    results = list(pool.map(get, range(8)))
bad = [(s, len(set(re.findall(r'href="/products/(\d+)"', b)))) for s, b in results
       if s != 200 or "20 products · read from" not in b or len(set(re.findall(r'href="/products/(\d+)"', b))) != 20]
if bad:
    sys.exit(f"  ✕ {len(bad)} of 8 requests did not list the 20 products: {bad[:3]}")
print("   all 8 listed the 20 products, each through its own request's client")
PY

echo "   ▸ the component's own smokeCommand, DEPLOYED_URL=$url"
smoke="$(python3 -c "import yaml,sys;print(yaml.safe_load(open(sys.argv[1]))['spec']['parameters']['smokeCommand'])" "$tree/apps/web/component.yaml")"
DEPLOYED_URL="$url" bash -c "$smoke" || { echo "FAIL: the deploy's smoke refused the product" >&2; tail -20 "$scratch/dev.log" >&2; exit 1; }

echo "   ▸ every route the product promises, and the pages reading the database"
python3 - "$url" "$values" "$pgurl" <<'PY' || { echo "FAIL: the routes; wrangler dev said:" >&2; tail -40 "$scratch/dev.log" >&2; exit 1; }
import html, http.client, json, re, subprocess, sys, time, urllib.error, urllib.request
base, values, pgurl = sys.argv[1], json.load(open(sys.argv[2])), sys.argv[3]
name = values["productname"]
problems = []
def bad(m): problems.append(m)

def req(path):
    # A GET whose CONNECTION drops (not one that answers an error) is asked
    # again, twice at most, and says so: `wrangler dev` on a loaded machine
    # has dropped one.
    for attempt in range(3):
        try:
            with urllib.request.urlopen(base + path, timeout=60) as resp:
                return resp.status, {k.lower(): v for k, v in resp.headers.items()}, resp.read()
        except urllib.error.HTTPError as e:
            return e.code, {k.lower(): v for k, v in e.headers.items()}, e.read()
        except (http.client.RemoteDisconnected, ConnectionResetError) as e:
            if attempt == 2:
                raise
            print(f"   (GET {path}: the connection dropped ({e.__class__.__name__}) — asking again)")
            time.sleep(1)
def psql(sql):
    return subprocess.run(["psql", pgurl, "-XAtc", sql], capture_output=True, text=True, check=True).stdout.strip()
def text(fragment):
    return html.unescape(re.sub(r"<[^>]+>", "", fragment)).strip()
INTERNAL = ("SUP-ACME-014", "Renegotiate freight", "WH-EU-2")

# ── the page, under the product's own name, as it is born ─────────────────
s, _, body = req("/"); page = body.decode().replace("<!-- -->", "")
if s != 200:
    bad(f"/ answered {s}")
title = re.search(r"<title>(.*?)</title>", page, re.S)
if not title or html.unescape(title.group(1)) != name:
    bad(f"the page's <title> is {title and title.group(1)!r}, not {name!r}")
if "Algolia x Supabase starter" in page:
    bad("the page still carries the baseline's name")
if 'data-search="not-connected"' not in page:
    bad("the page is not marked not-connected without the Algolia secrets")
if "Search activates once the" not in page or "ALGOLIA_SEARCH_API_KEY" not in page:
    bad("the page does not say which Algolia secrets to set")
ids = sorted({int(i) for i in re.findall(r'href="/products/(\d+)"', page)})
if ids != list(range(1, 21)):
    bad(f"the catalogue links products {ids}, not 1 to 20")
if "Aurora Wireless Headphones" not in page or "20 products · read from" not in text(page):
    bad("the catalogue does not list the demo products")
if any(x in page for x in INTERNAL):
    bad("the home page shows a database-only field")
for phrase in ("finds it.", "Cloudflare</span> wires them.", "deployed on\n            Cloudflare."):
    if phrase.replace("\n            ", " ") not in re.sub(r"\s+", " ", page):
        bad(f"the template's words are not there: {phrase!r}")

# ── a product page, read by id, with what only the database holds ─────────
s, _, body = req("/products/1"); prod = body.decode().replace("<!-- -->", "")
if s != 200 or "Aurora Wireless Headphones" not in prod:
    bad(f"/products/1 answered {s} without its product")
for x in ("Only in the database", "SUP-ACME-014", "In stock: 120", "$87.50"):
    if x not in prod:
        bad(f"/products/1 does not show {x!r}")
oos = psql("select id from products where quantity = 0 order by id limit 1")
s, _, body = req(f"/products/{oos}")
if s != 200 or "Out of stock" not in body.decode():
    bad(f"/products/{oos} (no stock) does not say Out of stock ({s})")
for path in ("/products/9999", "/products/abc", "/products/1.5", "/no-such-page"):
    s, _, _ = req(path)
    if s != 404:
        bad(f"{path} answered {s}, not 404")

# ── what only the Worker answers ──────────────────────────────────────────
s, h, body = req("/api/health")
if s != 200 or json.loads(body) != {"ok": True, "database": "reachable", "schema": "migrated", "search": "not connected"} \
        or h.get("cache-control") != "no-store":
    bad(f"/api/health answered {s} {body[:160]!r} ({h.get('cache-control')})")
s, h, body = req("/favicon.ico")
if s != 200 or not h.get("content-type", "").startswith("image/") or not body:
    bad(f"/favicon.ico answered {s} {h.get('content-type')}")

# ── the pages read the database (locally on every request: no Hyperdrive cache)
psql("insert into products (id, name, description, category, price, quantity, cost_price, internal_notes) "
     "values (1001, 'Ada''s Lamp', 'A brass desk lamp.', 'Home', 42, 3, 9.5, 'E2E internal note')")
s, _, body = req("/"); page = body.decode().replace("<!-- -->", "")
if s != 200 or 'href="/products/1001"' not in page or "21 products · read from" not in text(page) \
        or "E2E internal note" in page:
    bad(f"a product written behind the app's back is not on the next render, or its internal note is ({s})")
s, _, body = req("/products/1001"); prod = html.unescape(body.decode().replace("<!-- -->", ""))
if s != 200 or "Ada's Lamp" not in prod or "E2E internal note" not in prod or "$9.50" not in prod:
    bad(f"/products/1001 does not read the new row, its database-only fields included ({s})")
psql("delete from products where id = 1001")

if problems:
    for p in problems:
        print(f"  ✕ {p}", file=sys.stderr)
    sys.exit(1)
print(f"   / as {name!r}: not connected, the notice and 20 catalogue cards, no internal field; "
      f"/products/1 with its database-only fields, an out-of-stock page, four 404s; /api/health; "
      f"the favicon; a product added behind its back read on the next render")
PY
stop_group "$dev_pid"; dev_pid=""

# ── 6. the same Worker with the Algolia secrets, searched in a browser ─────
echo "── wrangler dev with the Algolia secrets, and a stand-in for Algolia's search API"
algolia_port="$(free_port)"
setsid python3 "$here/lib/fake-algolia.py" "$algolia_port" "$tree/packages/db/src/migrations/030_demo_products/up.sql" \
  "$scratch/algolia-requests.log" > "$scratch/algolia.log" 2>&1 < /dev/null &
algolia_pid=$!
for _ in $(seq 1 30); do curl -s -o /dev/null -X OPTIONS "http://127.0.0.1:$algolia_port/" && break; sleep 0.3; done
grep -q ', 20 records' "$scratch/algolia.log" || { echo "FAIL: the Algolia stand-in did not index the 20 demo products" >&2; cat "$scratch/algolia.log" >&2; exit 1; }
app_id="E2EAPP$(python3 -c 'import secrets;print(secrets.token_hex(3).upper())')"
# The write key is set too, as an owner might store it: nothing may read it.
serve "$scratch/dev-connected.log" --var "ALGOLIA_APP_ID:$app_id" --var "ALGOLIA_SEARCH_API_KEY:$algolia_key" \
  --var "ALGOLIA_HOST:http://127.0.0.1:$algolia_port" --var "ALGOLIA_WRITE_API_KEY:e2e-admin-never-in-a-page"
python3 - "$url" "$app_id" "$algolia_key" <<'PY' || { echo "FAIL: the connected page; wrangler dev said:" >&2; tail -40 "$scratch/dev-connected.log" >&2; exit 1; }
import json, sys, urllib.request
base, app_id, key = sys.argv[1:]
problems = []
with urllib.request.urlopen(base + "/api/health", timeout=60) as r:
    health = json.loads(r.read())
if health != {"ok": True, "database": "reachable", "schema": "migrated", "search": "connected"}:
    problems.append(f"/api/health answered {health}")
with urllib.request.urlopen(base + "/", timeout=60) as r:
    page = r.read().decode()
if 'data-search="connected"' not in page:
    problems.append("the page is not marked connected with the Algolia secrets")
if 'href="/products/' in page:
    problems.append("the server rendered the catalogue although search is connected")
if app_id not in page or key not in page:
    problems.append("the page does not hand the browser the application id and search-only key")
if "e2e-admin-never-in-a-page" in page:
    problems.append("the page carries the write key")
for p in problems:
    print(f"  ✕ {p}", file=sys.stderr)
sys.exit(1 if problems else 0)
PY
echo "   /api/health says connected; the page hands the browser the app id and search-only key, never the write key"

echo "   ▸ headless Chrome: InstantSearch against the stand-in"
dom="$scratch/connected.dom.html"
"$chrome" --headless=new --no-sandbox --disable-gpu --no-first-run --no-default-browser-check \
  --user-data-dir="$scratch/chrome-profile" --virtual-time-budget=15000 --dump-dom "$url/" > "$dom" 2> "$scratch/chrome.log" \
  || { echo "FAIL: Chrome did not load the page" >&2; tail -20 "$scratch/chrome.log" >&2; exit 1; }
python3 - "$dom" "$scratch/algolia-requests.log" "$app_id" "$algolia_key" <<'PY' || { echo "FAIL: the search in the browser" >&2; exit 1; }
import json, re, sys
dom, log, app_id, key = sys.argv[1:]
page = open(dom).read()
problems = []
if "ais-SearchBox-input" not in page:
    problems.append("the browser rendered no SearchBox")
if not re.search(r'ais-Stats-text">20 results · \d+ms<', page):
    problems.append(f"the browser's stats are not 20 results: {re.findall(r'ais-Stats-text[^<]*', page)[:1]}")
ids = sorted({int(i) for i in re.findall(r'href="/products/(\d+)"', page)})
if ids != list(range(1, 21)):
    problems.append(f"the browser's hits link products {ids}, not 1 to 20")
cats = re.findall(r'ais-RefinementList-labelText[^>]*>([^<]+)<', page)
if len(cats) < 2:
    problems.append(f"the browser's category facets are {cats}")
if "Hide out of stock" not in page or "Out of stock" not in page.replace("Hide out of stock", ""):
    problems.append("the browser shows no stock toggle or no out-of-stock badge")
seen = [json.loads(l) for l in open(log)]
queries = [s for s in seen if s["path"] == "/1/indexes/*/queries"]
if not queries:
    problems.append("the browser never queried the stand-in")
elif any(s["app"] != app_id or s["key"] != key for s in queries):
    problems.append(f"the browser queried with {set((s['app'], s['key']) for s in queries)}, not the Worker's app id and key")
elif not any('"indexName":"products"' in s["body"].replace(" ", "") for s in queries):
    problems.append("the browser did not query the products index")
for p in problems:
    print(f"  ✕ {p}", file=sys.stderr)
if problems:
    sys.exit(1)
print(f"   Chrome ran InstantSearch: 20 hits, {len(cats)} categories and the stock toggle, from "
      f"{len(queries)} quer{'y' if len(queries) == 1 else 'ies'} carrying the Worker's app id and search-only key")
PY
stop_group "$dev_pid"; dev_pid=""
stop_group "$algolia_pid"; algolia_pid=""

# ── 7. what Supabase's Data API would see ──────────────────────────────────
echo "── the Data API's roles (anon, authenticated) against the same database"
psql "$pgurl" -X -q -v ON_ERROR_STOP=1 -At > "$scratch/rls.out" 2> "$scratch/rls.err" <<'SQL' \
  || { echo "FAIL: the row-level security checks" >&2; cat "$scratch/rls.err" >&2; exit 1; }
SELECT 'app role: superuser=' || rolsuper || ' bypassrls=' || rolbypassrls FROM pg_roles WHERE rolname = current_user;
SELECT 'public tables without RLS: ' || count(*) FILTER (WHERE NOT c.relrowsecurity) || ' of ' || count(*)
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p');
SELECT 'not owned by the app: ' || count(*) FILTER (WHERE pg_get_userbyid(c.relowner) <> current_user)
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p');
SELECT 'app sees products: ' || count(*) FROM products;
SET ROLE anon;
SELECT 'anon sees products: ' || count(*) FROM products;
SELECT 'anon sees internal notes: ' || count(*) FROM products WHERE internal_notes IS NOT NULL;
RESET ROLE;
SET ROLE authenticated;
SELECT 'authenticated sees products: ' || count(*) FROM products;
RESET ROLE;
SQL
sed 's/^/   /' "$scratch/rls.out"
grep -qx "app role: superuser=false bypassrls=false" "$scratch/rls.out" \
  && grep -qE "^public tables without RLS: 0 of [1-9][0-9]*$" "$scratch/rls.out" \
  && grep -qx "not owned by the app: 0" "$scratch/rls.out" \
  || { echo "FAIL: the app's role, the tables' owner or their row-level security is not what Supabase's would be" >&2; exit 1; }
app_rows="$(sed -n 's/^app sees products: //p' "$scratch/rls.out")"
[ "${app_rows:-0}" -ge 20 ] || { echo "FAIL: the app does not see the demo products" >&2; exit 1; }
for line in "anon sees products: 0" "anon sees internal notes: 0" "authenticated sees products: 0"; do
  grep -qx "$line" "$scratch/rls.out" || { echo "FAIL: expected '$line'" >&2; exit 1; }
done
# A write through the Data API's roles is refused by row-level security.
for role in anon authenticated; do
  if psql "$pgurl" -X -q -At -c "SET ROLE $role; INSERT INTO products (id, name, description, category, price) VALUES (3001, '$role', 'x', 'x', 1)" > "$scratch/rls-write.log" 2>&1; then
    echo "FAIL: $role wrote a product through row-level security" >&2; exit 1
  fi
  grep -q "row-level security" "$scratch/rls-write.log" \
    || { echo "FAIL: $role's write was refused for another reason:" >&2; cat "$scratch/rls-write.log" >&2; exit 1; }
done
echo "   anon and authenticated, granted what Supabase grants them, read $app_rows product(s) as 0 and write none"

echo "e2e.test.sh: ok"
