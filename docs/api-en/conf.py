from __future__ import annotations

import os
import sys
from datetime import datetime
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]
DOCS_ROOT = Path(__file__).resolve().parents[1]

# Make local extension importable
sys.path.insert(0, str(DOCS_ROOT / "_ext"))

project = "MindQuantum API (EN)"
author = "MindQuantum Contributors"
copyright = f"{datetime.now().year}, MindQuantum"

extensions = [
    "sphinx.ext.autodoc",
    "sphinx.ext.autosummary",
    "sphinx.ext.napoleon",
    "myst_parser",
    "sphinx.ext.mathjax",
    "mqdocs",
]

templates_path = [str(DOCS_ROOT / "_templates")]
exclude_patterns = [
    "_build",
    "Thumbs.db",
    ".DS_Store",
]

language = "en"

html_theme = "sphinx_book_theme"
html_static_path = [str(DOCS_ROOT / "_static")]
html_css_files = ["mq-sphinx.css"]

autosummary_generate = False  # Let mqdocs.autogen handle ms* directives

# Keep autosummary stubs consistent
autosummary_imported_members = False

