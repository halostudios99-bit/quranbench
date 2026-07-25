"""Filesystem locations for the pipeline. Everything is resolved relative to the
``corpus-build`` package root so the pipeline runs the same from any cwd."""

from __future__ import annotations

import hashlib
from pathlib import Path

PACKAGE_ROOT = Path(__file__).resolve().parent.parent
SOURCES_DIR = PACKAGE_ROOT / "sources"
OUT_DIR = PACKAGE_ROOT / "out"
CHECKSUMS_FILE = SOURCES_DIR / "checksums.json"


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 16), b""):
            digest.update(chunk)
    return digest.hexdigest()


def sha256_text(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()
