"""Verify an existing artifact directory against its manifest checksums.

This is what an outside researcher runs to confirm a published corpus version is
byte-for-byte what the pipeline emitted — no build, no trust in the loader:

    python -m pipeline.verify packages/corpus-build/out/v0.4.0

Every artifact listed in ``manifest.json``'s ``checksums`` block is re-hashed and
its size re-checked; any file present on disk but absent from the block (or listed
but missing) is a mismatch too. Exits non-zero on the first sign of tampering.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

from .build import MANIFEST_NAME
from .paths import sha256_bytes


def verify(out_dir: Path) -> list[str]:
    """Return a list of human-readable mismatch messages; empty means verified."""
    errors: list[str] = []

    manifest_path = out_dir / MANIFEST_NAME
    if not manifest_path.is_file():
        return [f"{MANIFEST_NAME} not found in {out_dir}"]

    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        return [f"{MANIFEST_NAME} is not valid JSON: {exc}"]

    checksums = manifest.get("checksums")
    if not isinstance(checksums, dict):
        return [f"{MANIFEST_NAME} has no 'checksums' block"]

    # Every listed artifact must exist and match.
    for rel, expected in sorted(checksums.items()):
        path = out_dir / rel
        if not path.is_file():
            errors.append(f"{rel}: listed in manifest but missing on disk")
            continue
        data = path.read_bytes()
        actual_sha = sha256_bytes(data)
        if actual_sha != expected.get("sha256"):
            errors.append(
                f"{rel}: sha256 mismatch — manifest {expected.get('sha256')}, "
                f"file {actual_sha}"
            )
        if len(data) != expected.get("bytes"):
            errors.append(
                f"{rel}: size mismatch — manifest {expected.get('bytes')} bytes, "
                f"file {len(data)} bytes"
            )

    # Every file on disk (except the manifest) must be accounted for.
    for path in sorted(out_dir.rglob("*")):
        if not path.is_file():
            continue
        rel = path.relative_to(out_dir).as_posix()
        if rel == MANIFEST_NAME:
            continue
        if rel not in checksums:
            errors.append(f"{rel}: present on disk but not listed in manifest")

    return errors


def main(argv: list[str] | None = None) -> int:
    args = sys.argv[1:] if argv is None else argv
    if len(args) != 1:
        print("usage: python -m pipeline.verify <artifact-dir>", file=sys.stderr)
        return 2

    out_dir = Path(args[0])
    errors = verify(out_dir)
    if errors:
        print(f"FAILED: {out_dir} does not match its manifest", file=sys.stderr)
        for err in errors:
            print(f"  {err}", file=sys.stderr)
        return 1

    manifest = json.loads((out_dir / MANIFEST_NAME).read_text(encoding="utf-8"))
    count = len(manifest["checksums"])
    print(f"OK: {out_dir} — {count} artifacts match manifest checksums")
    return 0


if __name__ == "__main__":
    sys.exit(main())
