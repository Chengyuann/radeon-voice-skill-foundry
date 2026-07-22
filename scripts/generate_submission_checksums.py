#!/usr/bin/env python3
"""Generate SHA-256 checksums for finalized submission artifacts."""

from __future__ import annotations

import hashlib
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SUBMISSION = ROOT / "submission"
MANIFEST = SUBMISSION / "SHA256SUMS.txt"


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def main() -> None:
    artifacts = sorted(
        path
        for path in SUBMISSION.rglob("*")
        if path.is_file() and path != MANIFEST
    )
    lines = [
        f"{sha256(path)}  {path.relative_to(SUBMISSION).as_posix()}"
        for path in artifacts
    ]
    MANIFEST.write_text("\n".join(lines) + "\n", encoding="ascii")
    print(f"Wrote {MANIFEST} with {len(lines)} entries.")


if __name__ == "__main__":
    main()
