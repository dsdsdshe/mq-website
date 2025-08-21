#!/usr/bin/env python3
"""
Sync MindQuantum API sources from a local clone of the MindQuantum repo.

Copies:
- <MQ_REPO_PATH>/docs/api_python_en → docs/en/src
- <MQ_REPO_PATH>/docs/api_python    → docs/zh/src

Usage:
  MQ_REPO_PATH=/path/to/mindquantum python scripts/sync_mindquantum_api.py

If a source directory is missing, it is skipped.
"""
from __future__ import annotations
import os
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

DEST_EN = ROOT / 'docs' / 'en' / 'src'
DEST_ZH = ROOT / 'docs' / 'zh' / 'src'

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
    mq_repo = os.environ.get('MQ_REPO_PATH')
    if not mq_repo:
        raise SystemExit('Set MQ_REPO_PATH to your local mindquantum clone')
    mq_root = Path(mq_repo).expanduser().resolve()
    if not mq_root.exists():
        raise SystemExit(f'Invalid MQ_REPO_PATH: {mq_root}')

    en_src = mq_root / 'docs' / 'api_python_en'
    zh_src = mq_root / 'docs' / 'api_python'

    if en_src.exists():
        print(f'Copying EN API: {en_src} → {DEST_EN}')
        copy_into(en_src, DEST_EN)
    else:
        print(f'EN API directory not found, skipping: {en_src}')

    if zh_src.exists():
        print(f'Copying ZH API: {zh_src} → {DEST_ZH}')
        copy_into(zh_src, DEST_ZH)
    else:
        print(f'ZH API directory not found, skipping: {zh_src}')

    print('Done.')

if __name__ == '__main__':
    main()

