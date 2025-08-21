# Design Overview

This repository hosts both the MindQuantum website (Astro) and the documentation portal (Jupyter Book) to ensure a cohesive, maintainable user experience.

## Goals

- Single deployment to GitHub Pages for site + docs
- Consistent branding via shared design tokens
- Clear separation of concerns for easier maintenance
- Ability to source tutorials from MindSpore docs without a hard dependency

## Architecture

- Astro site at repo root. Static output in `dist/`.
- Jupyter Book project in `docs/`. Build output goes into `public/docs`, which Astro serves as static assets at `/docs/`.
- GitHub Actions flow builds Jupyter Book first, then Astro, and deploys the combined `dist/`.

## Theming Strategy

- Shared CSS variables in `src/styles/tokens.css` model brand color, typography, and spacing.
- Build step (`scripts/prepare-tokens.mjs`) syncs tokens into `docs/_static/mq-variables.css` so Jupyter Book can use the same variables.
- `docs/_static/mq-theme.css` applies light overrides on top of `sphinx_book_theme` to reflect the brand without forking the upstream theme.

This approach avoids maintaining a heavy bespoke Sphinx theme while still achieving visual parity and keeping upgrade paths simple.

## Content Sourcing

- The build does not depend on external repositories.
- A helper script `scripts/sync_mindspore_docs.py` can copy tutorial content from a local clone of `mindspore/docs` into `docs/content/` when needed. This lets you iterate locally while keeping CI deterministic.

## Deployment

- GitHub Actions computes the correct `ASTRO_BASE` for project pages (e.g., `/mq-website/`) and sets it during the Astro build.
- Artifacts from both builders are uploaded together for a single Pages deployment.

## Future Enhancements

- Add dedicated API reference via Sphinx autodoc in `docs/` and expose under `/docs/api/`.
- Add language switcher and versioned docs (e.g., by building multiple books into `public/docs/vX/`).
- Replace the simple CSS stack with Tailwind + PostCSS in Astro if desired; tokens remain the source of truth.

