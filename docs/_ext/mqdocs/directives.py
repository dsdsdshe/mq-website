from __future__ import annotations

import inspect
import os
import re
from pathlib import Path
from typing import Iterable, List, Optional, Sequence, Tuple

from docutils import nodes
from sphinx import addnodes
from sphinx.ext.autosummary import Autosummary
from sphinx.util import logging

try:  # Sphinx >= 5
    from sphinx.ext.autosummary.generate import import_by_name  # type: ignore
except Exception:  # pragma: no cover - fallback
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
                # Emulate a shape compatible with Sphinx (name, obj, parent, modname, qualname)
                return [(name, obj, None, modname, qualname)]
            except Exception as e:  # keep walking up
                last_exc = e
                modname, tail = modname.rsplit(".", 1)
                qualname = tail + ("." + qualname if qualname else "")
        if last_exc:
            raise last_exc
        raise ImportError(f"Cannot import {name}")


_RE_MATH_BLOCK = re.compile(
    r"^\s*\.\.\s+math::\s*\n((?:\s{2,}.+\n?)+)", re.MULTILINE
)
_RE_NOTE_BLOCK = re.compile(
    r"^\s*\.\.\s+note::\s*\n((?:\s{2,}.+\n?)+)", re.MULTILINE
)
_RE_PY_OBJ = re.compile(
    r"^\s*\.\.\s+py:(class|function|method|attribute|property|module|data)::\s+([^\s]+)\s*$"
)


def _safe_read(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8")
    except Exception:
        return ""


def _dedent_block(text: str) -> str:
    lines = text.splitlines()
    # Compute minimal indent on non-empty lines
    indents = [len(l) - len(l.lstrip()) for l in lines if l.strip()]
    if not indents:
        return text.strip()
    cut = min(indents)
    return "\n".join(l[cut:] for l in lines).strip()


def _first_paragraph(lines: List[str]) -> str:
    buf: List[str] = []
    seen_text = False
    for ln in lines:
        if not ln.strip():
            if seen_text:
                break
            else:
                continue
        # skip option lines like ':param foo:' which are indented
        if ln.lstrip().startswith(":"):
            continue
        seen_text = True
        buf.append(ln.strip())
    return " ".join(buf).strip()


def _extract_docstring_section(doc: str, kind: str) -> Optional[str]:
    if not doc:
        return None
    if kind == "math":
        m = _RE_MATH_BLOCK.search(doc)
        if not m:
            return None
        block = _dedent_block(m.group(1))
        # Use first line as inline representation
        first = block.splitlines()[0].strip()
        return first
    if kind == "note":
        m = _RE_NOTE_BLOCK.search(doc)
        if not m:
            return None
        block = _dedent_block(m.group(1))
        # One-liner of the note
        first = block.splitlines()[0].strip()
        return first
    if kind == "platform":
        # Look for 'Supported Platforms:' lines
        for ln in doc.splitlines():
            if "Supported Platforms:" in ln:
                return ln.split("Supported Platforms:", 1)[1].strip()
        return None
    return None


def _import_object_by_fullname(fullname: str):
    """Try importing an object by fullname.

    Returns: (obj, module_name, qualname) or (None, None, None) on failure.
    """
    try:
        res = import_by_name(fullname)
    except Exception:
        return None, None, None
    if not res:
        return None, None, None
    item = res[0]
    # Sphinx 7 may add extra fields; pick robustly
    try:
        obj = item[1]
        modname = item[-2]
        qualname = item[-1]
    except Exception:
        return None, None, None
    return obj, modname, qualname


def _find_cn_rst_path(srcdir: Path, current_docname: str, toctree_dir: Optional[str], fullname: str) -> Optional[Path]:
    # Current document directory
    current_doc_path = srcdir / (current_docname + ".rst")
    base_dir = current_doc_path.parent
    if toctree_dir:
        base_dir = (base_dir / toctree_dir).resolve()
    candidates = [base_dir / (fullname + ".rst")]
    # Also try by last component
    tail = fullname.rsplit(".", 1)[-1]
    candidates.append(base_dir / (tail + ".rst"))
    # Also try the parent object file for methods/attributes
    if "." in fullname:
        parent = fullname.rsplit(".", 1)[0]
        candidates.append(base_dir / (parent + ".rst"))
    for c in candidates:
        if c.exists():
            return c
    return None


def _extract_cn_from_rst(rst_path: Path, fullname: str) -> tuple[Optional[str], Optional[str], Optional[str]]:
    """Extract (summary, note, math) from a CN per-object RST file.

    Heuristics only; avoids importing Python code.
    """
    text = _safe_read(rst_path)
    if not text:
        return None, None, None
    lines = text.splitlines()
    # Locate the py directive matching fullname or its tail
    full = fullname
    tail = fullname.rsplit(".", 1)[-1]
    start_idx = None
    for i, ln in enumerate(lines):
        m = _RE_PY_OBJ.match(ln)
        if not m:
            continue
        objname = m.group(2).strip()
        if objname == full or objname == tail:
            start_idx = i
            break
    if start_idx is None:
        # Fallback: first py directive
        for i, ln in enumerate(lines):
            if _RE_PY_OBJ.match(ln):
                start_idx = i
                break
    if start_idx is None:
        return None, None, None

    # Gather block under the directive (until next top-level directive or section)
    block: List[str] = []
    for ln in lines[start_idx + 1 :]:
        # Stop on an unindented directive or section underline
        if ln and not ln.startswith(" ") and ln.startswith(".. "):
            break
        block.append(ln)
    block_text = "\n".join(block)

    # Summary: first paragraph skipping option lines
    summary = _first_paragraph(block)

    # Note and Math blocks
    note = None
    math = None
    m = _RE_NOTE_BLOCK.search(block_text)
    if m:
        note = _dedent_block(m.group(1)).splitlines()[0].strip()
    m = _RE_MATH_BLOCK.search(block_text)
    if m:
        math = _dedent_block(m.group(1)).splitlines()[0].strip()

    return (summary or None, note, math)


class _MsBaseAutosummary(Autosummary):
    """Base for MindQuantum autosummary variants.

    Keeps default autosummary behavior (including stub generation + toctree),
    but overrides table rendering to add a third column when needed, and custom
    summary extraction for CN when possible.
    """

    # Set in subclasses: "en" or "cn"
    locale: str = "en"
    # Kind of third column if any: one of {None, "math", "note", "platform"}
    third_kind: Optional[str] = None

    # Column headers per locale/kind
    HEADERS = {
        ("en", None): ("API Name", "Description"),
        ("en", "math"): ("API Name", "Description", "Math"),
        ("en", "note"): ("API Name", "Description", "Note"),
        ("en", "platform"): ("API Name", "Description", "Supported Platforms"),
        ("cn", None): ("接口名", "概述"),
        ("cn", "math"): ("接口名", "概述", "数学表示"),
        ("cn", "note"): ("接口名", "概述", "说明"),
        ("cn", "platform"): ("接口名", "概述", "支持平台"),
    }

    def _compute_third(self, real_name: str) -> Optional[str]:
        if not self.third_kind:
            return None
        # CN platform derives from Python docstring; other CN kinds read from RST
        if self.locale == "en" or self.third_kind == "platform":
            obj, _mod, _qual = _import_object_by_fullname(real_name)
            doc = inspect.getdoc(obj) if obj is not None else None
            return _extract_docstring_section(doc or "", self.third_kind)
        else:
            # CN math/note from per-object RST
            env = self.state.document.settings.env  # type: ignore[attr-defined]
            toctree_dir = self.options.get("toctree")
            rst_path = _find_cn_rst_path(Path(env.srcdir), env.docname, toctree_dir, real_name)
            if not rst_path:
                return None
            _summary, note, math = _extract_cn_from_rst(rst_path, real_name)
            if self.third_kind == "note":
                return note
            if self.third_kind == "math":
                return math
            return None

    def _compute_cn_summary(self, real_name: str, current_summary: str) -> str:
        env = self.state.document.settings.env  # type: ignore[attr-defined]
        logger = logging.getLogger(__name__)
        warn_missing = bool(getattr(env.app.config, "mqdocs_warn_missing_cn_summary", True))
        toctree_dir = self.options.get("toctree")
        rst_path = _find_cn_rst_path(Path(env.srcdir), env.docname, toctree_dir, real_name)
        if not rst_path:
            # Strict CN behavior: do not fall back to docstrings
            if warn_missing:
                logger.warning(
                    "CN autosummary: RST not found for %s (doc=%s, toctree=%s)",
                    real_name,
                    env.docname,
                    toctree_dir or "",
                )
            return ""
        summary, _note, _math = _extract_cn_from_rst(rst_path, real_name)
        # Strict CN behavior: blank if missing
        if not (summary and summary.strip()):
            if warn_missing:
                logger.warning(
                    "CN autosummary: missing summary in %s for %s",
                    rst_path,
                    real_name,
                )
            return ""
        return summary

    # Suppress "include current module" warnings by clearing current-module context
    def get_items(self, names: Sequence[str]):  # type: ignore[override]
        env = self.state.document.settings.env  # type: ignore[attr-defined]
        ref_context = getattr(env, "ref_context", None)
        temp_data = getattr(env, "temp_data", None)
        prev_ref = ref_context.get("py:module") if ref_context else None
        prev_tmp = temp_data.get("py:module") if temp_data else None
        try:
            if ref_context is not None:
                ref_context["py:module"] = None
            if temp_data is not None:
                temp_data["py:module"] = None
            return super().get_items(names)
        finally:
            if ref_context is not None:
                if prev_ref is None:
                    ref_context.pop("py:module", None)
                else:
                    ref_context["py:module"] = prev_ref
            if temp_data is not None:
                if prev_tmp is None:
                    temp_data.pop("py:module", None)
                else:
                    temp_data["py:module"] = prev_tmp

    def get_table(self, items: Sequence[Tuple[str, str, str, str]]):  # type: ignore[override]
        # Potentially adjust summaries for CN and compute third column
        enriched: List[Tuple[str, str, str, str, Optional[str]]] = []
        for name, sig, summary, real_name in items:
            if self.locale == "cn":
                summary = self._compute_cn_summary(real_name, summary)
            third = self._compute_third(real_name)
            enriched.append((name, sig, summary, real_name, third))

        # Build a docutils table manually
        table = nodes.table()
        tgroup = nodes.tgroup(cols=3 if self.third_kind else 2)
        table += tgroup
        for _ in range(3 if self.third_kind else 2):
            tgroup += nodes.colspec(colwidth=1)
        thead = nodes.thead()
        tgroup += thead
        tbody = nodes.tbody()
        tgroup += tbody

        header_labels = self.HEADERS[(self.locale, self.third_kind)]
        header_row = nodes.row()
        for label in header_labels:
            entry = nodes.entry()
            para = nodes.paragraph(text=str(label))
            entry += para
            header_row += entry
        thead += header_row

        for name, sig, summary, real_name, third in enriched:
            row = nodes.row()
            # Name cell with pending_xref to object
            entry_name = nodes.entry()
            para = nodes.paragraph()
            xref = addnodes.pending_xref(
                "",
                refdomain="py",
                reftype="obj",
                reftarget=real_name,
                modname=None,
                classname=None,
            )
            short = real_name.rsplit(".", 1)[-1]
            display = short + (sig or "")
            xref += nodes.literal(text=display)
            para += xref
            entry_name += para
            row += entry_name

            # Summary cell
            entry_sum = nodes.entry()
            entry_sum += nodes.paragraph(text=summary or "")
            row += entry_sum

            # Third column if any
            if self.third_kind:
                entry_third = nodes.entry()
                txt = third or ""
                entry_third += nodes.paragraph(text=txt)
                row += entry_third

            tbody += row

        # Autosummary expects a list of nodes
        return [table]


# EN variants (docstring-derived third columns)
class MsMathAutosummary(_MsBaseAutosummary):
    locale = "en"
    third_kind = "math"


class MsNoteAutosummary(_MsBaseAutosummary):
    locale = "en"
    third_kind = "note"


class MsPlatformAutosummary(_MsBaseAutosummary):
    locale = "en"
    third_kind = "platform"


# CN variants (read summaries/third columns from local RST files)
class MsCnAutosummary(_MsBaseAutosummary):
    locale = "cn"
    third_kind = None


class MsCnMathAutosummary(_MsBaseAutosummary):
    locale = "cn"
    third_kind = "math"


class MsCnNoteAutosummary(_MsBaseAutosummary):
    locale = "cn"
    third_kind = "note"


class MsCnPlatformAutosummary(_MsBaseAutosummary):
    locale = "cn"
    third_kind = "platform"
