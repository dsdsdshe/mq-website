#!/usr/bin/env python3
"""
Sync MindQuantum API sources from an auto-managed clone of the MindQuantum repo.

Copies ONLY into the dedicated Sphinx API projects:
- .upstreams/mindquantum/docs/api_python_en → docs/api-en/api_python_en
- .upstreams/mindquantum/docs/api_python    → docs/api-zh/api_python

Usage:
  python scripts/sync_mindquantum_api.py [--update]

If a source directory is missing, it is skipped.
"""
from __future__ import annotations
import argparse
import shutil
from pathlib import Path

try:
    from .upstream_utils import ensure_repo
except Exception:
    from upstream_utils import ensure_repo  # type: ignore

ROOT = Path(__file__).resolve().parents[1]

DEST_API_EN = ROOT / "docs" / "api-en" / "api_python_en"
DEST_API_ZH = ROOT / "docs" / "api-zh" / "api_python"


def copy_into(src: Path, dst: Path) -> None:
    for item in src.iterdir():
        target = dst / item.name
        if item.is_dir():
            if target.exists():
                shutil.rmtree(target)
            shutil.copytree(item, target)
        else:
            shutil.copy2(item, target)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Sync MindQuantum API sources into local Jupyter Books"
    )
    parser.add_argument(
        "--update", action="store_true", help="Update upstream clones before syncing"
    )
    args = parser.parse_args()

    # Always use auto-managed mindquantum clone
    mq_root = ensure_repo("mindquantum", update=args.update)

    en_src = mq_root / "docs" / "api_python_en"
    zh_src = mq_root / "docs" / "api_python"

    if en_src.exists():
        print(f"Copying EN API → {DEST_API_EN}")
        DEST_API_EN.mkdir(parents=True, exist_ok=True)
        copy_into(en_src, DEST_API_EN)
    else:
        print(f"EN API directory not found, skipping: {en_src}")

    if zh_src.exists():
        print(f"Copying ZH API → {DEST_API_ZH}")
        DEST_API_ZH.mkdir(parents=True, exist_ok=True)
        copy_into(zh_src, DEST_API_ZH)
    else:
        print(f"ZH API directory not found, skipping: {zh_src}")

    print("Done.")


if __name__ == "__main__":
    main()
