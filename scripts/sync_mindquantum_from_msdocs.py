#!/usr/bin/env python3
"""
Sync MindQuantum tutorials from a local clone of mindspore/docs.

Copies Sphinx sources for EN and ZH into this repo's Jupyter Book projects:
- <MS_DOCS_PATH>/docs/mindquantum/docs/source_en    → docs/en/src
- <MS_DOCS_PATH>/docs/mindquantum/docs/source_zh_cn → docs/zh/src

Usage:
  MS_DOCS_PATH=/path/to/mindspore-docs python scripts/sync_mindquantum_from_msdocs.py

The build remains independent; this script vendors content as needed.
"""
from __future__ import annotations
import os
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

SRC_EN_REL = Path('docs/mindquantum/docs/source_en')
SRC_ZH_REL = Path('docs/mindquantum/docs/source_zh_cn')

DEST_EN = ROOT / 'docs' / 'en' / 'src'
DEST_ZH = ROOT / 'docs' / 'zh' / 'src'

SKIP_NAMES = { 'conf.py', '_templates' }

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
    en_src = mq_repo / 'RELEASE.md'
    zh_src = mq_repo / 'RELEASE_CN.md'
    if en_src.exists():
        (DEST_EN / 'RELEASE.md').write_text(en_src.read_text(encoding='utf-8'), encoding='utf-8')
        print(f'Wrote EN release → {DEST_EN / "RELEASE.md"}')
    if zh_src.exists():
        (DEST_ZH / 'RELEASE.md').write_text(zh_src.read_text(encoding='utf-8'), encoding='utf-8')
        print(f'Wrote ZH release → {DEST_ZH / "RELEASE.md"}')

def main() -> None:
    ms_docs = os.environ.get('MS_DOCS_PATH')
    if not ms_docs:
        raise SystemExit('Set MS_DOCS_PATH to your local mindspore/docs clone')
    ms_root = Path(ms_docs).expanduser().resolve()
    if not (ms_root / 'docs').exists():
        raise SystemExit(f'Invalid MS_DOCS_PATH (no docs/ found): {ms_root}')

    src_en = ms_root / SRC_EN_REL
    src_zh = ms_root / SRC_ZH_REL

    print(f'Copying EN tutorials: {src_en} → {DEST_EN}')
    copy_tree_filtered(src_en, DEST_EN)

    print(f'Copying ZH tutorials: {src_zh} → {DEST_ZH}')
    copy_tree_filtered(src_zh, DEST_ZH)

    mq_repo_env = os.environ.get('MQ_REPO_PATH')
    if mq_repo_env:
        try:
            write_release_pages(Path(mq_repo_env).expanduser().resolve())
        except Exception as e:
            print(f'WARN: Failed to write release pages: {e}')
    else:
        print('MQ_REPO_PATH not set; skipping RELEASE.md generation.')

    print('Done.')

if __name__ == '__main__':
    main()
