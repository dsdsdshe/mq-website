from __future__ import annotations

import re
from typing import List


_RE_METHOD = re.compile(r"^(?P<indent>\s*)\.\.\s+py:method::\s+(?P<sig>[^\n]+?)\s*$")
_RE_OPTION_PROPERTY = re.compile(r"^\s*:property:\s*$")


def normalize_py_property_option(app, docname: str, source: List[str]) -> None:
    """Normalize upstream pattern '.. py:method:: name' with ':property:' option.

    Rewrites the directive to '.. py:property:: name' and removes ':property:'
    to avoid Sphinx 'unknown option: "property"' errors. Keeps indentation and
    other options/content intact.
    """
    if not source:
        return
    text = source[0]
    lines = text.splitlines(keepends=True)
    out: List[str] = []
    i = 0

    while i < len(lines):
        m = _RE_METHOD.match(lines[i])
        if not m:
            out.append(lines[i])
            i += 1
            continue

        base_indent = len(m.group("indent"))
        sig = m.group("sig").strip()
        # collect the directive block (options and content) indented beyond base
        block = [lines[i]]
        i += 1
        j = i
        found_property = False
        while j < len(lines):
            ln = lines[j]
            if ln.strip() == "":
                block.append(ln)
                j += 1
                continue
            indent = len(ln) - len(ln.lstrip(" "))
            if indent <= base_indent:
                break
            # detect and drop the ':property:' option line
            if _RE_OPTION_PROPERTY.match(ln):
                found_property = True
                j += 1
                continue
            block.append(ln)
            j += 1

        if found_property:
            out.append(" " * base_indent + f".. py:property:: {sig}\n")
            out.extend(block[1:])
        else:
            out.extend(block)
        i = j

    source[0] = "".join(out)

