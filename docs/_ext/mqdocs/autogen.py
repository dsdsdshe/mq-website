from __future__ import annotations

import io
import os
import re
import textwrap
from pathlib import Path
from typing import Iterable, List, Optional, Tuple

from sphinx.application import Sphinx

try:
    from sphinx.ext.autosummary.generate import import_by_name  # type: ignore
except Exception:
    import importlib

    def import_by_name(name: str):  # type: ignore
        modname, qualname = name, ""
        obj = None
        last_exc = None
        while "." in modname:
            try:
                mod = importlib.import_module(modname)
                obj = mod
                for part in qualname.split("."):
                    if not part:
                        continue
                    obj = getattr(obj, part)
                return [(name, obj, None, modname, qualname)]
            except Exception as e:  # keep walking up
                last_exc = e
                modname, tail = modname.rsplit(".", 1)
                qualname = tail + ("." + qualname if qualname else "")
        if last_exc:
            raise last_exc
        raise ImportError(f"Cannot import {name}")


RE_MS_AUTOSUMMARY = re.compile(r"^\.\.\s+(ms[a-z]+autosummary)::\s*$", re.IGNORECASE)


def _parse_ms_block(lines: List[str], start_idx: int) -> Tuple[Optional[str], List[str], int]:
    """Parse an ms*autosummary block.

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


def _guess_directive_for_obj(obj) -> str:
    import inspect
    import types

    if obj is None:
        return "py:obj"
    if inspect.ismodule(obj):
        return "automodule"
    if inspect.isclass(obj):
        return "autoclass"
    if inspect.isfunction(obj):
        return "autofunction"
    if inspect.ismethod(obj):
        return "automethod"
    return "autodata"


def _generate_stub_content(qualname: str) -> str:
    """Generate a reasonable autodoc stub for a qualified name.

    If the object can be imported, choose an autodoc directive based on its type.
    Otherwise, create a minimal py:obj target.
    """
    try:
        res = import_by_name(qualname)
        if res:
            item = res[0]
            obj = item[1]
            modname = item[-2]
        else:
            obj = None
            modname = None
    except Exception:
        obj = None
        modname = None

    directive = _guess_directive_for_obj(obj)
    title = qualname
    underline = "=" * len(title)

    if obj is None:
        body = f".. py:obj:: {qualname}\n"
    else:
        # Set currentmodule when available for nicer headings/links
        cm = f".. currentmodule:: {modname}\n\n" if modname else ""
        if directive in {"autoclass", "automethod", "autofunction", "autodata"}:
            body = (
                f"{cm}.. {directive}:: {qualname}\n"
                "   :members:\n"
                "   :undoc-members:\n"
            )
        elif directive == "automodule":
            body = (
                f"{cm}.. automodule:: {qualname}\n"
                "   :members:\n"
                "   :undoc-members:\n"
                "   :show-inheritance:\n"
            )
        else:
            body = f".. py:obj:: {qualname}\n"

    return f"{title}\n{underline}\n\n{body}\n"


def _write_file(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


def _clean_filename(name: str) -> str:
    # Use fully-qualified name as filename, replacing problematic characters
    return name.replace(" ", "_")


def on_builder_inited(app: Sphinx) -> None:
    """Scan for ms*autosummary directives and generate missing stubs.

    This mirrors autosummary's own generation strategy but only targets our
    custom directives, leaving standard autosummary untouched.
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
            if RE_MS_AUTOSUMMARY.match(lines[i] or ""):
                toctree_dir, items, i = _parse_ms_block(lines, i)
                # Destination folder: under the source file directory (like autosummary)
                base_dir = rst.parent
                if toctree_dir:
                    base_dir = (base_dir / toctree_dir).resolve()
                # Generate missing stubs
                for qualname in items:
                    outfile = base_dir / (_clean_filename(qualname) + ".rst")
                    if outfile.exists():
                        continue
                    content = _generate_stub_content(qualname)
                    _write_file(outfile, content)
            else:
                i += 1
