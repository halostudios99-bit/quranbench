"""Stage 1 — fetch.

Download every upstream ``Source`` into ``sources/`` and verify each against the
SHA-256 recorded in ``sources/checksums.json``. A file already present with a
matching checksum is left untouched. A checksum mismatch is a hard error — the
pipeline never silently re-downloads or overwrites over a bad hash.
"""

from __future__ import annotations

import json
import sys
import urllib.request
from pathlib import Path

from .lexicon import LANE_FILES, lane_raw_url
from .paths import CHECKSUMS_FILE, SOURCES_DIR, sha256_file
from .sources import SOURCES, Source
from .translations import TRANSLATIONS, Translation


class ChecksumError(RuntimeError):
    pass


def load_checksums() -> dict[str, str]:
    data = json.loads(CHECKSUMS_FILE.read_text(encoding="utf-8"))
    return {k: v for k, v in data.items() if not k.startswith("_")}


def _download(url: str, dest: Path) -> None:
    req = urllib.request.Request(url, headers={"User-Agent": "quranbench-corpus-build"})
    with urllib.request.urlopen(req, timeout=60) as resp:  # noqa: S310 (trusted upstream)
        dest.write_bytes(resp.read())


def _fetch_file(url: str, filename: str, expected: dict[str, str]) -> str:
    dest = SOURCES_DIR / filename
    want = expected.get(filename)
    if want is None:
        raise ChecksumError(f"no recorded checksum for {filename}")

    if dest.exists() and sha256_file(dest) == want:
        return "cached"

    _download(url, dest)
    got = sha256_file(dest)
    if got != want:
        raise ChecksumError(
            f"checksum mismatch for {filename}: expected {want}, got {got}"
        )
    return "downloaded"


def fetch_source(source: Source, expected: dict[str, str]) -> str:
    return _fetch_file(source.url, source.filename, expected)


def fetch_translation(translation: Translation, expected: dict[str, str]) -> str:
    return _fetch_file(translation.url, translation.filename, expected)


def fetch_lane(expected: dict[str, str]) -> dict[str, str]:
    """Fetch every Lane's Lexicon TEI file into ``sources/lane/`` (see
    pipeline.lexicon). Checksum keys are POSIX-relative (``lane/<name>.xml``)."""
    (SOURCES_DIR / "lane").mkdir(parents=True, exist_ok=True)
    results: dict[str, str] = {}
    for name in LANE_FILES:
        rel = f"lane/{name}.xml"
        results[rel] = _fetch_file(lane_raw_url(name), rel, expected)
    return results


def fetch_all() -> dict[str, str]:
    SOURCES_DIR.mkdir(parents=True, exist_ok=True)
    expected = load_checksums()
    results: dict[str, str] = {}
    for source in SOURCES:
        results[source.id] = fetch_source(source, expected)
    for translation in TRANSLATIONS:
        results[translation.id] = fetch_translation(translation, expected)
    results.update(fetch_lane(expected))
    return results


def main() -> int:
    for source_id, status in fetch_all().items():
        print(f"{status:>10}  {source_id}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
