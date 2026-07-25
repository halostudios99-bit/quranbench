"""Full-dataset distribution tarball for a built corpus version.

Alongside the per-file artifacts (each downloadable on its own under its own
licence), every version also ships one ``.tar.gz`` holding the *complete*
artifact set — the whole version directory in a single file — with a sidecar
``.sha256`` so a downloader can verify it byte-for-byte.

The tarball is a *derived distribution* artifact, not a corpus file: it is
deliberately absent from ``manifest.json``'s ``checksums`` block (it embeds the
manifest, so listing it there would be circular) and is instead self-described by
its ``.sha256`` sidecar. ``compute_output_checksums`` and ``verify`` both exclude
it for the same reason.

Because it embeds ``tokens.jsonl`` and ``morphology/`` (the GPL Leeds QAC
annotation), the tarball as a whole is GPL-2.0-or-later — the copyleft of the
strongest-licensed file it contains propagates to the aggregate.

The bytes are deterministic given identical inputs: entries are added in sorted
path order with a fixed mtime, uid/gid and mode, and the gzip wrapper carries no
timestamp or filename. The only non-reproducible input is ``manifest.json``'s
``built_at`` timestamp, which the build already pins when ``SOURCE_DATE_EPOCH``
is set — so with that set, the tarball checksum is stable across rebuilds.
"""

from __future__ import annotations

import gzip
import io
import tarfile
from pathlib import Path

from .paths import sha256_bytes

MANIFEST_NAME = "manifest.json"


def full_tarball_name(version: str) -> str:
    return f"quranbench-corpus-v{version}.tar.gz"


def full_tarball_sha_name(version: str) -> str:
    return f"{full_tarball_name(version)}.sha256"


def is_distribution_file(rel: str, version: str) -> bool:
    """True for the full tarball and its sidecar — the derived distribution files
    that are excluded from the manifest checksum block and from verify."""
    return rel in {full_tarball_name(version), full_tarball_sha_name(version)}


def _reset(info: tarfile.TarInfo) -> tarfile.TarInfo:
    info.mtime = 0
    info.uid = 0
    info.gid = 0
    info.uname = ""
    info.gname = ""
    info.mode = 0o644
    return info


def build_tarball_bytes(
    out_dir: Path, version: str, exclude: frozenset[str] = frozenset()
) -> bytes:
    """Deterministic gzip-compressed tar of every file in ``out_dir`` except the
    tarball, its sidecar, and any path in ``exclude``. Includes ``manifest.json``.
    Entries are prefixed with ``quranbench-corpus-v<version>/`` so the archive
    extracts into a named dir.

    ``exclude`` carries the POSIX-relative paths of display-only, non-redistributable
    artifacts (e.g. a CC BY-NC-ND translation edition and its licence file): they
    exist on disk and are served to readers, but must never enter the redistributable
    full-dataset tarball.
    """
    prefix = f"quranbench-corpus-v{version}"
    files = sorted(
        p
        for p in out_dir.rglob("*")
        if p.is_file()
        and not is_distribution_file(p.relative_to(out_dir).as_posix(), version)
        and p.relative_to(out_dir).as_posix() not in exclude
    )

    raw = io.BytesIO()
    # mtime=0 and an empty filename keep the gzip header free of any timestamp or
    # name, so the compressed bytes depend only on the tar payload.
    with gzip.GzipFile(fileobj=raw, mode="wb", mtime=0) as gz:
        with tarfile.open(fileobj=gz, mode="w", format=tarfile.USTAR_FORMAT) as tar:
            for path in files:
                rel = path.relative_to(out_dir).as_posix()
                info = _reset(tar.gettarinfo(str(path), arcname=f"{prefix}/{rel}"))
                with path.open("rb") as fh:
                    tar.addfile(info, fh)
    return raw.getvalue()


def write_full_tarball(
    out_dir: Path, version: str, exclude: frozenset[str] = frozenset()
) -> tuple[Path, Path]:
    """Write the full-dataset tarball and its ``.sha256`` sidecar into ``out_dir``.
    ``exclude`` names display-only artifacts to keep out of the redistributable
    archive. Returns the (tarball, sidecar) paths."""
    data = build_tarball_bytes(out_dir, version, exclude)
    tar_path = out_dir / full_tarball_name(version)
    tar_path.write_bytes(data)

    digest = sha256_bytes(data)
    sha_path = out_dir / full_tarball_sha_name(version)
    # Standard ``shasum`` sidecar format: "<hash>  <filename>\n".
    sha_path.write_text(
        f"{digest}  {full_tarball_name(version)}\n", encoding="utf-8"
    )
    return tar_path, sha_path
