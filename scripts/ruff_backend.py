"""Run Ruff from backend/, matching GitHub Actions `backend-lint`."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent / "backend"


def main(argv: list[str] | None = None) -> int:
    args = list(argv if argv is not None else sys.argv[1:])
    if not args:
        args = ["check"]
    return subprocess.call([sys.executable, "-m", "ruff", *args, "."], cwd=BACKEND_DIR)


if __name__ == "__main__":
    raise SystemExit(main())
