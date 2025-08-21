#!/usr/bin/env python3
"""
Sync MindQuantum tutorial content from a local clone of mindspore/docs.

Usage:
  MS_DOCS_PATH=/path/to/mindspore-docs python scripts/sync_mindspore_docs.py

This script intentionally avoids network access. It copies selected
directories/files into ./docs/content while preserving relative paths.

Customize SOURCE_MAP below to map from the source repo to our book.
"""
from __future__ import annotations
import os
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEST_ROOT = ROOT / 'docs' / 'content'

# TODO: Update these mappings to the actual locations of MindQuantum
# tutorials within the mindspore/docs repository.
SOURCE_MAP = [
    # ("relative/path/in/mindspore-docs", "relative/dest/path")
    # Example:
    # ("docs/mindquantum/tutorials", "mindquantum/tutorials")
]

def copytree(src: Path, dst: Path) -> None:
    if dst.exists():
        shutil.rmtree(dst)
    shutil.copytree(src, dst)

def main() -> None:
    ms_docs = os.environ.get("MS_DOCS_PATH")
    if not ms_docs:
        raise SystemExit("Set MS_DOCS_PATH to your local mindspore/docs clone")
    src_root = Path(ms_docs).expanduser().resolve()
    if not src_root.exists():
        raise SystemExit(f"MS_DOCS_PATH does not exist: {src_root}")

    DEST_ROOT.mkdir(parents=True, exist_ok=True)

    if not SOURCE_MAP:
        print("SOURCE_MAP is empty. Edit scripts/sync_mindspore_docs.py to map sources → destinations.")
        return

    for rel_src, rel_dst in SOURCE_MAP:
        src = src_root / rel_src
        dst = DEST_ROOT / rel_dst
        if not src.exists():
            print(f"WARN: Source path missing: {src}")
            continue
        print(f"Copying {src} → {dst}")
        copytree(src, dst)

if __name__ == '__main__':
    main()

