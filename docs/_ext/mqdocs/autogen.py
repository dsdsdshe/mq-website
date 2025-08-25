from __future__ import annotations

import re
from pathlib import Path
from typing import List, Optional, Tuple

from sphinx.application import Sphinx


RE_ANY_AUTOSUMMARY = re.compile(
    r"^\.\.\s+((ms[a-z]+autosummary)|autosummary)::\s*$",
    re.IGNORECASE,
)


def _parse_autosummary_block(
    lines: List[str], start_idx: int
) -> Tuple[Optional[str], List[str], int]:
    """Parse an autosummary-like block (supports ms*autosummary and autosummary).

    Returns: (toctree_dir, items, end_index)
    """
    toctree_dir: Optional[str] = None
    items: List[str] = []
    i = start_idx + 1
    # Consume indented block (options and items)
    while i < len(lines) and (not lines[i].strip() or lines[i].startswith(" ")):
        ln = lines[i]
        if ln.strip().startswith(":toctree:"):
            # Matches ':toctree: path'
            _, _, rest = ln.partition(":toctree:")
            toctree_dir = rest.strip() or None
        elif ln.strip().startswith(":"):
            # other options ignored
            pass
        elif ln.strip():
            items.append(ln.strip())
        i += 1
    # Clean items (drop comments/empty)
    items = [it for it in items if it and not it.startswith(".. ")]
    return toctree_dir, items, i


def _guess_directive_by_name(qualname: str) -> str:
    """Lightweight heuristic to choose an autodoc directive without importing.

    - Dotted name with capitalized tail → autoclass
    - Dotted name with snake_case tail → autofunction
    - Bare module name (no dot) → automodule
    - Fallback → py:obj (safe and import-free)
    """
    if "." not in qualname:
        return "automodule"
    tail = qualname.rsplit(".", 1)[-1]
    # Heuristics: CamelCase or typical class suffixes
    if tail[:1].isupper() or any(
        tail.endswith(s) for s in ("Gate", "Channel", "Layer", "Ops", "Operator")
    ):
        return "autoclass"
    # snake_case likely means function
    if tail.lower() == tail or "_" in tail:
        return "autofunction"
    return "py:obj"


def _generate_stub_content(qualname: str) -> str:
    """Generate a stable stub without importing target objects.

    Produces one of: automodule, autoclass, autofunction, or py:obj.
    Only adds :members: for automodule/autoclass; avoids invalid options for others.
    """
    directive = _guess_directive_by_name(qualname)
    title = qualname
    underline = "=" * len(title)

    if directive == "automodule":
        body = (
            f".. automodule:: {qualname}\n"
            "   :members:\n"
            "   :undoc-members:\n"
            "   :show-inheritance:\n"
        )
    elif directive == "autoclass":
        mod = qualname.rsplit(".", 1)[0]
        body = (
            f".. currentmodule:: {mod}\n\n"
            f".. autoclass:: {qualname}\n"
            "   :members:\n"
            "   :undoc-members:\n"
        )
    elif directive == "autofunction":
        mod = qualname.rsplit(".", 1)[0]
        body = (
            f".. currentmodule:: {mod}\n\n"
            f".. autofunction:: {qualname}\n"
        )
    else:
        body = f".. py:obj:: {qualname}\n"

    return f"{title}\n{underline}\n\n{body}\n"


def _needs_rewrite(path: Path) -> bool:
    """Detect obviously broken/generated stubs from previous runs.

    Rewrites when:
    - bogus currentmodule like '.. currentmodule:: i'
    - autodata directives combined with ':members:' (invalid)
    """
    try:
        text = path.read_text(encoding="utf-8").lower()
    except Exception:
        return False
    if ".. currentmodule:: i\n" in text or ".. currentmodule:: i\r\n" in text:
        return True
    if ".. autodata::" in text and ":members:" in text:
        return True
    return False


def _write_file(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


def _clean_filename(name: str) -> str:
    # Use fully-qualified name as filename, replacing problematic characters
    return name.replace(" ", "_")


def on_builder_inited(app: Sphinx) -> None:
    """Scan autosummary-like directives and generate missing stubs (EN only).

    We intentionally do not import project code; stubs are generated from names
    for stability across environments. CN builds are left untouched (authored RSTs).
    """
    # Do not generate stubs in CN builds; CN sources provide authored RSTs
    lang = (getattr(app.config, 'language', '') or '').lower()
    if lang.startswith('zh'):
        return
    srcdir = Path(app.srcdir)
    for rst in srcdir.rglob("*.rst"):
        try:
            text = rst.read_text(encoding="utf-8")
        except Exception:
            continue
        lines = text.splitlines()
        i = 0
        while i < len(lines):
            if RE_ANY_AUTOSUMMARY.match(lines[i] or ""):
                toctree_dir, items, i = _parse_autosummary_block(lines, i)
                # Destination folder: under the source file directory (like autosummary)
                base_dir = rst.parent
                if toctree_dir:
                    base_dir = (base_dir / toctree_dir).resolve()
                # Generate missing stubs
                for qualname in items:
                    outfile = base_dir / (_clean_filename(qualname) + ".rst")
                    if (not outfile.exists()) or _needs_rewrite(outfile):
                        content = _generate_stub_content(qualname)
                        _write_file(outfile, content)
            else:
                i += 1
