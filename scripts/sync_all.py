#!/usr/bin/env python3
"""
Fetch upstream repositories (auto-clone/update) and sync both tutorials and API docs
into the local Jupyter Book projects.

Clones are maintained under <repo-root>/.upstreams by scripts/upstream_utils.py.

Usage:
  python scripts/sync_all.py            # clone if missing, reuse cache if present
  python scripts/sync_all.py --update   # fetch latest before syncing
"""
from __future__ import annotations
import argparse
import runpy
import sys
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--update", action="store_true", help="Update upstream clones before syncing"
    )
    args = parser.parse_args()

    # Propagate --update to sub-scripts by injecting argv
    sub_argv = ["--update"] if args.update else []

    scripts_dir = Path(__file__).resolve().parent

    # Run tutorial sync
    sys.argv = ["sync_mindquantum_from_msdocs.py", *sub_argv]
    runpy.run_path(
        str(scripts_dir / "sync_mindquantum_from_msdocs.py"), run_name="__main__"
    )

    # Run API sync
    sys.argv = ["sync_mindquantum_api.py", *sub_argv]
    runpy.run_path(str(scripts_dir / "sync_mindquantum_api.py"), run_name="__main__")


if __name__ == "__main__":
    main()
