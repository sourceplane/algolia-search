#!/usr/bin/env bash
# hooks/render-deployment-docs.sh runs in the build box, which has python3 but
# not PyYAML: a hook that imports yaml stops the record phase with exit 1
# while the product is live. This runs the hook on a scaffolded product tree
# under a python3 with no third-party packages (and again with the system
# python3, when it has PyYAML), and checks the record it writes: the
# workspace read from intent.yaml, the product's Workers, a probe row per URL
# (no such Worker exists, so whatever answers — nothing offline, workers.dev's
# 404 online — the database check is "unknown"), the optional Algolia secrets
# named, and the README's live-deployment section.
#
# Needs: bash, python3 (with venv), curl. The network is optional.
set -euo pipefail
here="$(cd "$(dirname "$0")/.." && pwd)"
work="$(mktemp -d)"; trap 'rm -rf "$work"' EXIT

python3 -m venv --without-pip "$work/bare"
if "$work/bare/bin/python3" -c 'import yaml' 2>/dev/null; then
  echo "render.test.sh: the bare python3 still imports yaml — cannot test" >&2; exit 1
fi
if grep -nE '^\s*(import|from)\s+yaml\b|import yaml' "$here/hooks/render-deployment-docs.sh"; then
  echo "render.test.sh: the hook imports yaml, which the build box does not have" >&2; exit 1
fi

product="$work/product"; mkdir -p "$product/.github/workflows" "$product/.rebrand"
printf '{"reponame":"acme-search","subdomain":"acme"}\n' > "$product/.rebrand/values.json"
printf '# acme-search\n\nA product.\n\n## Live deployment\n\n<!-- 02-docs:begin -->\nNot recorded yet.\n<!-- 02-docs:end -->\n\n## What is here\n' > "$product/README.md"
printf 'jobs:\n  lane:\n    steps:\n      - with:\n          version: v2.78.4\n' > "$product/.github/workflows/ci.yml"
cat > "$product/intent.yaml" <<'YAML'
execution:
  state:
    # the product's own workspace
    workspace: ws_TEST0000  # set by the bootstrap
environments:
  stage:
    env:
      BASE_DOMAIN: acme-search.example.com
YAML

fail=0
for py in "$work/bare/bin" ""; do
  label="${py:+without PyYAML}"; label="${label:-with the system python3}"
  [ -n "$py" ] || python3 -c 'import yaml' 2>/dev/null || { echo "   (skipped: the system python3 has no PyYAML)"; continue; }
  rm -rf "$product/ai"
  # No workspace argument: the hook reads it from intent.yaml.
  if ! (cd "$product" && PATH="${py:+$py:}$PATH" bash "$here/hooks/render-deployment-docs.sh" . "" "$here" >/dev/null 2>"$work/err"); then
    echo "  ✕ $label: the hook failed"; sed 's/^/      /' "$work/err"; fail=1; continue
  fi
  rec="$product/ai/context/deployment.md"
  bad() { echo "  ✕ $label: $1"; fail=1; }
  grep -q '| Orun workspace | `ws_TEST0000` |' "$rec" || bad "the workspace is not read from intent.yaml"
  grep -q '`acme-search-web-stage`, `acme-search-web-prod` on `acme.workers.dev`' "$rec" || bad "the Workers are not the product's"
  grep -qE '^\| app \(prod\) \| https://acme-search-web-prod\.acme\.workers\.dev \| (unreachable|answering [0-9]{3}|LIVE \([0-9]{3}\)) \|$' "$rec" || bad "the prod probe row is wrong"
  grep -qE '^\| stage \| unknown \(/api/health (unreachable|answered [0-9]{3}, not JSON)\) \|$' "$rec" || bad "the stage database check is not reported as unknown"
  grep -q '`ALGOLIA_APP_ID`, `ALGOLIA_SEARCH_API_KEY`' "$rec" || bad "the optional Algolia secrets are not named"
  grep -q 'orun `v2.78.4`' "$rec" || bad "the CI lane pin is not read"
  grep -q 'This product is \*\*live\*\*' "$product/README.md" || bad "the README's live-deployment section is not rendered"
  [ "$(grep -c '<!-- 02-docs:begin -->' "$product/README.md")" = 1 ] || bad "the README's section is not replaced in place"
  [ -f "$product/ai/context/operations.md" ] || bad "operations.md was not healed from the baseline's copy"
  [ "$fail" = 0 ] && echo "   $label: record rendered, the workspace read from intent.yaml"
done
[ "$fail" = 0 ] || exit 1
echo "render.test.sh: ok"
