# MindQuantum Website

Astro + Jupyter Book monorepo for the MindQuantum website and bilingual documentation.

## Overview

- Astro powers the homepage and overall site shell.
- Jupyter Book builds bilingual tutorials only (EN+ZH).
- Sphinx builds the API reference as two projects (EN+ZH) using the internal `mqdocs` extension.
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

4) Build docs (tutorials + API)

```bash
npm run build:docs   # auto-syncs upstreams, builds JB (tutorials) + Sphinx (API)
```

5) Run the site

```bash
npm run dev
```

## Content Syncing

- Auto-clone: Upstreams are cached under `.upstreams/` using `scripts/upstreams.json`.
- Tutorials: `scripts/sync_mindquantum_from_msdocs.py` vendors Sphinx sources from the cached `mindspore-docs` clone.
- API: `scripts/sync_mindquantum_api.py` vendors API sources from the cached `mindquantum` clone. It also syncs into the standalone Sphinx projects at `docs/api-en/api_python_en` and `docs/api-zh/api_python`.

### API (Sphinx) Projects

In addition to the Jupyter Books, the API reference builds as two Sphinx projects using a clean internal extension (`mqdocs`):

- `docs/api-en/` – English API, uses `ms*autosummary` directives that derive third columns from docstrings
- `docs/api-zh/` – Chinese API, uses `mscnautosummary` directives that read summaries from the local RST pages

Shared assets live under `docs/_ext`, `docs/_templates`, and `docs/_static`.

Local build example:

```bash
# Ensure sources are synced into docs/api-*/
python scripts/sync_mindquantum_api.py

# Build EN API (centralized under docs/_build)
sphinx-build -b html docs/api-en docs/_build/api/en

# Build ZH API (centralized under docs/_build)
sphinx-build -b html docs/api-zh docs/_build/api/zh
```

The extension avoids monkey-patches and implements stable `mscnautosummary`/`ms*autosummary` directives plus a minimal stub generator for those directives only. Standard autosummary remains untouched.

## Build and Deploy

- `npm run build:all` builds Jupyter Books and Sphinx into `public/docs/**`, then builds Astro into `dist/`. Temporary artifacts are centralized under `docs/_build/`.
- GitHub Actions workflow `.github/workflows/deploy.yml` builds both and deploys the `dist/` folder to GitHub Pages. The Astro base path is computed automatically for project pages.

## Docs Routing

- Tutorials (Jupyter Book): `/docs/en` and `/docs/zh` (from `public/docs/en` and `public/docs/zh`).
- API (Sphinx): `/docs/api/en` and `/docs/api/zh` (from `public/docs/api/en` and `public/docs/api/zh`).
- The site header should link to Tutorials and API for both languages.

## Theming

- Shared CSS tokens live in `src/styles/tokens.css`.
- A small build step copies tokens to `docs/_static/mq-variables.css` so Jupyter Book can consume them.
- Jupyter Book loads `mq-variables.css` and `mq-theme.css` to style pages in line with the homepage.

## Structure

- `src/` – Astro pages, layouts, and styles.
- `public/` – static assets. Built docs are copied to `public/docs` (ignored by Git).
- `docs/` – Documentation workspace:
  - Jupyter Book projects: `docs/en` and `docs/zh` (tutorials only)
  - Sphinx API projects: `docs/api-en` and `docs/api-zh`
  - Shared assets: `docs/_ext`, `docs/_static`, `docs/_templates`
- `scripts/` – helper scripts (token sync, upstream sync, local build).
