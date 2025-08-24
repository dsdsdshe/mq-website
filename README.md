# MindQuantum Website

Astro + Jupyter Book monorepo for the MindQuantum website and bilingual documentation.

## Overview

- Astro powers the homepage and overall site shell.
- Jupyter Book builds bilingual tutorials and API docs with a custom theme.
- Shared design tokens keep visual consistency across both.
- GitHub Pages workflow builds and deploys both outputs together.

## Local Development

Prerequisites: Node 18+ and Python 3.9+.

1) Install Node deps

```bash
npm install
```

2) (Optional) Create a Python venv and install Jupyter Book

```bash
python -m venv .venv
source .venv/bin/activate
pip install jupyter-book sphinx-copybutton sphinx-design mindspore mindquantum
```

3) Sync docs content (optional during dev)

You no longer need to set environment variables. The repo can auto-clone the
upstream sources into a local cache on first run. To sync both tutorials and
API docs:

```bash
npm run sync:all            # clone if missing, reuse cache if present
# or update to the latest upstreams before syncing
python scripts/sync_all.py --update
```

4) Build docs (optional during dev)

```bash
npm run build:docs   # auto-syncs upstreams, then builds both books
```

5) Run the site

```bash
npm run dev
```

## Content Syncing

- Auto-clone: Upstreams are cached under `.upstreams/` using `scripts/upstreams.json`.
- Tutorials: `scripts/sync_mindquantum_from_msdocs.py` vendors Sphinx sources from the cached `mindspore-docs` clone.
- API: `scripts/sync_mindquantum_api.py` vendors API sources from the cached `mindquantum` clone.

## Build and Deploy

- `npm run build:all` builds Jupyter Books into `public/docs/en` and `public/docs/zh`, then builds Astro into `dist/`.
- GitHub Actions workflow `.github/workflows/deploy.yml` builds both and deploys the `dist/` folder to GitHub Pages. The Astro base path is computed automatically for project pages.

## Docs Routing

- Astro serves the built documentation under `/docs/<lang>/...` from `public/docs/<lang>/`.
- The routes `/docs/en/` and `/docs/zh/` are lightweight Astro pages that redirect to a sensible start page (`/docs/<lang>/src/beginner/beginner.html`).
- Deep links like `/docs/en/src/...` are served directly as static assets from `public/` for performance and simplicity.

## Theming

- Shared CSS tokens live in `src/styles/tokens.css`.
- A small build step copies tokens to `docs/_static/mq-variables.css` so Jupyter Book can consume them.
- Jupyter Book loads `mq-variables.css` and `mq-theme.css` to style pages in line with the homepage.

## Structure

- `src/` – Astro pages, layouts, and styles.
- `public/` – static assets. Built docs are copied to `public/docs` (ignored by Git).
- `docs/` – Jupyter Book projects: `docs/en` and `docs/zh` share `docs/_static` for theme assets and tokens.
- `scripts/` – helper scripts (token sync, content sync, local build).
