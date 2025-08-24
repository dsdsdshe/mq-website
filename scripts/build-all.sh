#!/usr/bin/env bash
set -euo pipefail

# Build Jupyter Book into Astro's public path, then build Astro site.

echo "[0/2] Syncing upstreams (auto-clone if needed)"
python scripts/sync_all.py || echo "WARN: upstream sync skipped"

echo "[1/2] Building Jupyter Book → public/docs"
jupyter-book build docs --path-output public/docs

echo "[2/2] Building Astro site"
node scripts/prepare-tokens.mjs
astro build

echo "Build completed → dist/"
