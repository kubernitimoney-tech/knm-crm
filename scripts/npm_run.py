"""Run an npm script with Windows-safe executable lookup."""

from __future__ import annotations

import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def main(argv: list[str] | None = None) -> int:
    args = list(argv if argv is not None else sys.argv[1:])
    if len(args) < 2:
        print("usage: npm_run.py <prefix> <script>", file=sys.stderr)
        return 2
    prefix, script = args[0], args[1]
    prefix_dir = (ROOT / prefix).resolve()
    if not (prefix_dir / "node_modules" / "eslint").exists():
        print(
            f"Skipping {script}: {prefix}/node_modules/eslint is missing. "
            "Run npm ci in that app, or rely on CI ESLint.",
            file=sys.stderr,
        )
        return 0
    npm = shutil.which("npm") or shutil.which("npm.cmd")
    if npm is None:
        print(
            "npm not found on PATH. Install Node.js so frontend lint hooks can run.",
            file=sys.stderr,
        )
        return 1
    return subprocess.call([npm, "run", script, "--prefix", str(prefix_dir)])


if __name__ == "__main__":
    raise SystemExit(main())
