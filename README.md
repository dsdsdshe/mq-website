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
pip install jupyter-book sphinx-copybutton sphinx-design nbsphinx
```

3) Sync docs content (optional during dev)

Option A: Sync tutorials from a local `mindspore/docs` clone

```bash
export MS_DOCS_PATH=/path/to/mindspore-docs
python scripts/sync_mindquantum_from_msdocs.py
```

Option B: Sync API sources from a local `mindquantum` clone

```bash
export MQ_REPO_PATH=/path/to/mindquantum
python scripts/sync_mindquantum_api.py
```

4) Build docs (optional during dev)

```bash
npm run build:docs   # outputs to public/docs/en and public/docs/zh
```

5) Run the site

```bash
npm run dev
```

## Content Syncing

The build does not depend on external repos, but you can vendor content locally:

- Tutorials: `scripts/sync_mindquantum_from_msdocs.py` copies from `MS_DOCS_PATH` (`docs/mindquantum/docs/source_en` and `source_zh_cn`).
- API: `scripts/sync_mindquantum_api.py` copies from `MQ_REPO_PATH` (`docs/api_python_en` and `docs/api_python`).

## Build and Deploy

- `npm run build:all` builds Jupyter Books into `public/docs/en` and `public/docs/zh`, then builds Astro into `dist/`.
- GitHub Actions workflow `.github/workflows/deploy.yml` builds both and deploys the `dist/` folder to GitHub Pages. The Astro base path is computed automatically for project pages.

## Theming

- Shared CSS tokens live in `src/styles/tokens.css`.
- A small build step copies tokens to `docs/_static/mq-variables.css` so Jupyter Book can consume them.
- Jupyter Book loads `mq-variables.css` and `mq-theme.css` to style pages in line with the homepage.

## Structure

- `src/` – Astro pages, layouts, and styles.
- `public/` – static assets. Built docs are copied to `public/docs` (ignored by Git).
- `docs/` – Jupyter Book projects: `docs/en` and `docs/zh` share `docs/_static` for theme assets and tokens.
- `scripts/` – helper scripts (token sync, content sync, local build).
