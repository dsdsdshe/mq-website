"""
mqdocs: MindQuantum Sphinx helpers

This lightweight extension provides the custom autosummary-like directives used by the
MindQuantum docs and a minimal stub generator for those directives.

Directives (registered):
  - mscnautosummary, mscnmathautosummary, mscnnoteautosummary, mscnplatformautosummary
  - msmathautosummary, msnoteautosummary, msplatformautosummary

The extension avoids monkey-patching Sphinx internals and uses stable APIs.
"""
from __future__ import annotations

from sphinx.application import Sphinx

from .directives import (
    MsMathAutosummary,
    MsNoteAutosummary,
    MsPlatformAutosummary,
    MsCnAutosummary,
    MsCnMathAutosummary,
    MsCnNoteAutosummary,
    MsCnPlatformAutosummary,
)
from .autogen import on_builder_inited
from .normalize import normalize_py_property_option


def setup(app: Sphinx):
    # Config: optional warnings when CN summary is missing
    app.add_config_value("mqdocs_warn_missing_cn_summary", True, "env")

    # Register directives
    app.add_directive("msmathautosummary", MsMathAutosummary)
    app.add_directive("msnoteautosummary", MsNoteAutosummary)
    app.add_directive("msplatformautosummary", MsPlatformAutosummary)

    app.add_directive("mscnautosummary", MsCnAutosummary)
    app.add_directive("mscnmathautosummary", MsCnMathAutosummary)
    app.add_directive("mscnnoteautosummary", MsCnNoteAutosummary)
    app.add_directive("mscnplatformautosummary", MsCnPlatformAutosummary)

    # Hook minimal autogen for ms* directives
    app.connect("builder-inited", on_builder_inited)
    # Normalize upstream RST patterns before parsing
    app.connect("source-read", normalize_py_property_option)

    return {
        "version": "1.0",
        "parallel_read_safe": True,
        "parallel_write_safe": True,
    }
