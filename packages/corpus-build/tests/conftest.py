"""Shared fixtures. Tests run against the real, checksum-verified sources in
``sources/`` — the pipeline is meaningless on synthetic input."""

from __future__ import annotations

import pytest

from pipeline.paths import SOURCES_DIR


def _read(filename: str) -> str:
    path = SOURCES_DIR / filename
    if not path.exists():
        pytest.skip(f"missing source {filename}; run `python -m pipeline.fetch` first")
    return path.read_text(encoding="utf-8")


@pytest.fixture(scope="session")
def uthmani_raw() -> str:
    return _read("tanzil-uthmani.txt")


@pytest.fixture(scope="session")
def simple_raw() -> str:
    return _read("tanzil-simple.txt")


@pytest.fixture(scope="session")
def metadata_raw() -> str:
    return _read("quran-metadata.xml")
