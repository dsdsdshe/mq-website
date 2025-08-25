#!/usr/bin/env python3
"""
Generate Jupyter Book _toc.yml files for English and Chinese docs (tutorials only).

API is now built in dedicated Sphinx projects (docs/api-en, docs/api-zh), so
we deliberately exclude API pages from the books to avoid duplication.

It writes docs/<lang>/_toc.yml for langs: en, zh.
"""
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def has_dir(base: Path, name: str) -> bool:
    return (base / name).is_dir()


def gen_toc_for(lang: str) -> str:
    base = ROOT / "docs" / lang
    src = base / "src"

    # Build YAML content with glob-based sections to auto-include content.
    # Keep the root minimal and let parts/chapters drive the sidebar.
    lines: list[str] = []
    apidirs = [
        ("mindquantum.dtype", "dtype"),
        ("mindquantum.core", "core"),
        ("mindquantum.simulator", "simulator"),
        ("mindquantum.framework", "framework"),
        ("mindquantum.algorithm", "algorithm"),
        ("mindquantum.device", "device"),
        ("mindquantum.io", "io"),
        ("mindquantum.engine", None),
        ("mindquantum.utils", "utils"),
    ]

    lines.append("format: jb-book")
    lines.append("root: src/index")
    lines.append("")
    lines.append("parts:")

    # Tutorials
    lines.append("- caption: Tutorials")
    lines.append("  chapters:")
    tutorial_sections = [
        ("beginner/beginner", "beginner"),
        ("middle_level/middle_level", "middle_level"),
        ("advanced/advanced", "advanced"),
        ("case_library/case_library", "case_library"),
    ]
    for topfile, folder in tutorial_sections:
        if not (src / folder).exists():
            continue
        lines.append(f"  - file: src/{topfile}")
        # Include all pages in that folder. Use one-level glob to avoid duplicating the topfile.
        lines.append("    sections:")
        lines.append(f"    - glob: src/{folder}/*")

    # No API Reference in Jupyter Books; linked from site nav to Sphinx builds.

    # References / Misc
    lines.append("- caption: Reference")
    lines.append("  chapters:")
    for fname in ("mindquantum_install", "paper_with_code", "RELEASE"):
        if (src / f"{fname}.rst").exists() or (src / f"{fname}.md").exists():
            lines.append(f"  - file: src/{fname}")

    return "\n".join(lines) + "\n"


def write_toc(lang: str) -> None:
    toc = gen_toc_for(lang)
    out = ROOT / "docs" / lang / "_toc.yml"
    out.write_text(toc, encoding="utf-8")
    print(f"Wrote {out}")


def main() -> None:
    for lang in ("en", "zh"):
        write_toc(lang)


if __name__ == "__main__":
    main()
