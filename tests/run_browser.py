#!/usr/bin/env python3
"""Run the maintained browser suite instead of duplicating its scenarios."""
import subprocess
from pathlib import Path

if __name__ == '__main__':
    raise SystemExit(subprocess.call(['npm', 'run', 'test:e2e'], cwd=Path(__file__).resolve().parents[1]))
