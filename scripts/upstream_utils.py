#!/usr/bin/env python3
"""
Lightweight utility to clone/update upstream repositories into a local cache.

Design goals:
- No external deps; uses git CLI via subprocess.
- Deterministic local layout under <repo-root>/.upstreams (configurable).
- Shallow clones by default for speed; can update on demand.
- Graceful offline behavior: if fetch fails but a local copy exists, proceed.

Config lives in scripts/upstreams.json with shape:
{
  "baseDir": ".upstreams",
  "repos": {
    "mindspore-docs": {"url": "https://...", "ref": "master"},
    "mindquantum": {"url": "https://...", "ref": "master"}
  }
}
"""
from __future__ import annotations
import json
import os
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

ROOT = Path(__file__).resolve().parents[1]
CFG_PATH = ROOT / 'scripts' / 'upstreams.json'


@dataclass
class Upstream:
    name: str
    url: str
    ref: Optional[str] = None


def _load_config():
    # Defaults are sensible and can be overridden via JSON config
    default = {
        'baseDir': '.upstreams',
        'repos': {
            'mindspore-docs': {
                'url': 'https://gitee.com/mindspore/docs.git',
                'ref': 'master',
            },
            'mindquantum': {
                'url': 'https://gitee.com/mindspore/mindquantum.git',
                'ref': 'master',
            },
        },
    }
    if CFG_PATH.exists():
        try:
            with CFG_PATH.open('r', encoding='utf-8') as f:
                cfg = json.load(f)
            # shallow-merge defaults to allow partial overrides
            merged = default
            if 'baseDir' in cfg:
                merged['baseDir'] = cfg['baseDir']
            if 'repos' in cfg:
                merged['repos'].update(cfg['repos'])
            return merged
        except Exception:
            return default
    return default


def _run_git(args: list[str], cwd: Optional[Path] = None, check: bool = True) -> subprocess.CompletedProcess:
    return subprocess.run(['git', *args], cwd=str(cwd) if cwd else None, check=check, stdout=subprocess.PIPE, stderr=subprocess.PIPE)


def _looks_like_commit(ref: str) -> bool:
    # loose heuristic: 7+ hex chars
    if not ref:
        return False
    hexdigits = set('0123456789abcdefABCDEF')
    return len(ref) >= 7 and all(c in hexdigits for c in ref)


def ensure_repo(name: str, update: bool = False) -> Path:
    """
    Ensure an upstream repo is available locally and optionally updated.

    - If not present, shallow clone the configured ref (if any).
    - If present and update=True, try to fetch the configured ref and checkout.
    - On network errors, keep existing working tree and continue.
    """
    cfg = _load_config()
    repos = cfg.get('repos', {})
    if name not in repos:
        raise KeyError(f'Unknown upstream: {name}')
    info = repos[name]
    url = info.get('url')
    ref = info.get('ref')
    base = ROOT / cfg.get('baseDir', '.upstreams')
    base.mkdir(parents=True, exist_ok=True)
    dest = base / name

    def log(msg: str):
        print(f'[upstreams] {name}: {msg}')

    if not (dest / '.git').exists():
        # Fresh clone
        log(f'Cloning {url} → {dest}')
        try:
            if ref and not _looks_like_commit(ref):
                _run_git(['clone', '--filter=blob:none', '--no-tags', '--depth', '1', '--branch', ref, url, str(dest)])
            else:
                _run_git(['clone', '--filter=blob:none', url, str(dest)])
        except subprocess.CalledProcessError as e:
            raise SystemExit(f'Failed to clone {url}: {e.stderr.decode("utf-8", errors="ignore").strip()}')
        # If ref is a commit-ish (tag/sha), try to checkout specifically
        if ref and _looks_like_commit(ref):
            try:
                _run_git(['fetch', '--tags', 'origin'], cwd=dest)
                _run_git(['checkout', ref], cwd=dest)
            except subprocess.CalledProcessError:
                log(f'WARN: Failed to checkout ref {ref}; keeping default branch')
        return dest

    # Existing clone
    if update:
        try:
            log('Fetching updates…')
            if ref and not _looks_like_commit(ref):
                # Update branch: fetch that branch shallowly and reset local
                _run_git(['fetch', '--depth', '1', 'origin', ref], cwd=dest)
                # Create/reset local branch to remote tracking
                _run_git(['checkout', '-B', ref, f'origin/{ref}'], cwd=dest)
            else:
                # Unknown target; do a generic fetch
                _run_git(['fetch', '--tags', 'origin'], cwd=dest)
                if ref:
                    try:
                        _run_git(['checkout', ref], cwd=dest)
                    except subprocess.CalledProcessError:
                        log(f'WARN: Failed to checkout {ref}; leaving current HEAD')
        except subprocess.CalledProcessError as e:
            log(f'WARN: Fetch failed; proceeding with existing checkout ({e.stderr.decode("utf-8", errors="ignore").strip()})')
    else:
        log('Using cached checkout')

    return dest


def ensure_all(update: bool = False) -> dict[str, Path]:
    cfg = _load_config()
    names = list(cfg.get('repos', {}).keys())
    return {name: ensure_repo(name, update=update) for name in names}


if __name__ == '__main__':
    # Simple manual testing helper: ensure all repos
    upd = os.environ.get('UPSTREAMS_UPDATE') in ('1', 'true', 'yes')
    ensured = ensure_all(update=upd)
    for n, p in ensured.items():
        print(f'{n}: {p}')

