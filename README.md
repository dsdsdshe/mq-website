# MindQuantum Website

Astro + Jupyter Book monorepo for the MindQuantum website and documentation.

## Overview

- Astro powers the homepage and overall site shell.
- Jupyter Book builds tutorials and API docs with a custom theme.
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
pip install jupyter-book sphinx-copybutton sphinx-design
```

3) Build docs (optional during dev)

```bash
npm run build:docs   # outputs to public/docs
```

4) Run the site

```bash
npm run dev
```

## Syncing Tutorials from mindspore/docs

This repo does not depend on any external repo to build. If you want to pull tutorial content from a local clone of `mindspore/docs`:

```bash
export MS_DOCS_PATH=/path/to/mindspore-docs
python scripts/sync_mindspore_docs.py
```

Edit `scripts/sync_mindspore_docs.py` and update `SOURCE_MAP` to point to the correct source directories inside the MindSpore docs repo.

## Build and Deploy

- `npm run build:all` builds Jupyter Book into `public/docs` and then builds Astro into `dist/`.
- GitHub Actions workflow `.github/workflows/deploy.yml` builds both and deploys the `dist/` folder to GitHub Pages. The Astro base path is computed automatically for project pages.

## Theming

- Shared CSS tokens live in `src/styles/tokens.css`.
- A small build step copies tokens to `docs/_static/mq-variables.css` so Jupyter Book can consume them.
- Jupyter Book loads `mq-variables.css` and `mq-theme.css` to style pages in line with the homepage.

## Structure

- `src/` – Astro pages, layouts, and styles.
- `public/` – static assets. Built docs are copied to `public/docs` (ignored by Git).
- `docs/` – Jupyter Book project (config, ToC, content, and theme overrides).
- `scripts/` – helper scripts (token sync, content sync, local build).

