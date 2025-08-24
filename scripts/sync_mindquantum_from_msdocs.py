#!/usr/bin/env python3
"""
Sync MindQuantum tutorials from an auto-managed clone of mindspore/docs.

Copies Sphinx sources for EN and ZH into this repo's Jupyter Book projects:
- docs from .upstreams/mindspore-docs/docs/mindquantum/docs → docs/en/src
- docs from .upstreams/mindspore-docs/docs/mindquantum/docs → docs/zh/src

Usage:
  python scripts/sync_mindquantum_from_msdocs.py [--update]

The build remains independent; this script vendors content as needed.
"""
from __future__ import annotations
import os
import argparse
import shutil
from pathlib import Path

try:
    # Local helper to auto-clone upstreams
    from .upstream_utils import ensure_repo
except Exception:
    from upstream_utils import ensure_repo  # type: ignore

ROOT = Path(__file__).resolve().parents[1]

SRC_EN_REL = Path("docs/mindquantum/docs/source_en")
SRC_ZH_REL = Path("docs/mindquantum/docs/source_zh_cn")

DEST_EN = ROOT / "docs" / "en" / "src"
DEST_ZH = ROOT / "docs" / "zh" / "src"

SKIP_NAMES = {"conf.py", "_templates"}


def copy_tree_filtered(src: Path, dst: Path) -> None:
    if not src.exists():
        raise FileNotFoundError(f"Source path missing: {src}")
    if dst.exists():
        shutil.rmtree(dst)
    dst.mkdir(parents=True, exist_ok=True)
    for root, dirs, files in os.walk(src):
        rel_root = Path(root).relative_to(src)
        # filter directories
        dirs[:] = [d for d in dirs if d not in SKIP_NAMES]
        # ensure directory exists
        (dst / rel_root).mkdir(parents=True, exist_ok=True)
        # copy files, skipping unwanted
        for f in files:
            if f in SKIP_NAMES:
                continue
            src_file = Path(root) / f
            dst_file = dst / rel_root / f
            shutil.copy2(src_file, dst_file)


def write_release_pages(mq_repo: Path) -> None:
    en_src = mq_repo / "RELEASE.md"
    zh_src = mq_repo / "RELEASE_CN.md"
    if en_src.exists():
        (DEST_EN / "RELEASE.md").write_text(
            en_src.read_text(encoding="utf-8"), encoding="utf-8"
        )
        print(f'Wrote EN release → {DEST_EN / "RELEASE.md"}')
    if zh_src.exists():
        (DEST_ZH / "RELEASE.md").write_text(
            zh_src.read_text(encoding="utf-8"), encoding="utf-8"
        )
        print(f'Wrote ZH release → {DEST_ZH / "RELEASE.md"}')


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Sync tutorials from mindspore/docs into local Jupyter Books"
    )
    parser.add_argument(
        "--update", action="store_true", help="Update upstream clones before syncing"
    )
    args = parser.parse_args()

    # Always use auto-managed upstream clone for mindspore-docs
    ms_root = ensure_repo("mindspore-docs", update=args.update)
    if not (ms_root / "docs").exists():
        raise SystemExit(f"Invalid mindspore/docs path (no docs/ found): {ms_root}")

    src_en = ms_root / SRC_EN_REL
    src_zh = ms_root / SRC_ZH_REL

    print(f"Copying EN tutorials: {src_en} → {DEST_EN}")
    copy_tree_filtered(src_en, DEST_EN)

    print(f"Copying ZH tutorials: {src_zh} → {DEST_ZH}")
    copy_tree_filtered(src_zh, DEST_ZH)

    # Use auto-managed mindquantum clone for release notes
    try:
        mq_root = ensure_repo("mindquantum", update=args.update)
        write_release_pages(mq_root)
    except Exception as e:
        print(f"WARN: Skipping RELEASE.md generation: {e}")

    print("Done.")


if __name__ == "__main__":
    main()
