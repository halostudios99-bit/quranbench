from __future__ import annotations

import gzip
import io
import tarfile
from pathlib import Path

import pytest

from pipeline import build as build_mod
from pipeline.paths import sha256_bytes
from pipeline.tarball import (
    build_tarball_bytes,
    full_tarball_name,
    full_tarball_sha_name,
    write_full_tarball,
)


@pytest.fixture(scope="module")
def artifacts(tmp_path_factory) -> Path:
    out_root = tmp_path_factory.mktemp("out")
    return build_mod.build(out_root=out_root)


def test_build_emits_tarball_and_matching_sidecar(artifacts: Path) -> None:
    version = build_mod.CORPUS_VERSION
    tar_path = artifacts / full_tarball_name(version)
    sha_path = artifacts / full_tarball_sha_name(version)
    assert tar_path.is_file()
    assert sha_path.is_file()

    # The sidecar records the sha256 of the tarball bytes exactly.
    data = tar_path.read_bytes()
    recorded = sha_path.read_text(encoding="utf-8").split()[0]
    assert recorded == sha256_bytes(data)
    assert recorded == sha256_bytes(tar_path.read_bytes())
    # Sidecar uses the standard "<hash>  <filename>" shasum format.
    assert sha_path.read_text(encoding="utf-8").strip().endswith(
        full_tarball_name(version)
    )


def test_tarball_contains_the_redistributable_artifact_set(artifacts: Path) -> None:
    version = build_mod.CORPUS_VERSION
    prefix = f"quranbench-corpus-v{version}/"
    with gzip.open(artifacts / full_tarball_name(version), "rb") as gz:
        with tarfile.open(fileobj=io.BytesIO(gz.read()), mode="r") as tar:
            names = {m.name for m in tar.getmembers() if m.isfile()}

    # Display-only editions (e.g. Itani) are on disk but excluded from the tarball,
    # so the archive is the on-disk set minus those non-redistributable paths.
    from pipeline import translations as trans_mod

    excluded = {
        f"{trans_mod.TRANSLATIONS_DIR}/{t.id}.jsonl"
        for t in trans_mod.TRANSLATIONS
        if not t.redistributable
    } | {
        f"{trans_mod.TRANSLATIONS_DIR}/{t.id}.LICENSE.md"
        for t in trans_mod.TRANSLATIONS
        if not t.redistributable
    }
    on_disk = {
        prefix + p.relative_to(artifacts).as_posix()
        for p in artifacts.rglob("*")
        if p.is_file()
        and p.name != full_tarball_name(version)
        and p.name != full_tarball_sha_name(version)
        and p.relative_to(artifacts).as_posix() not in excluded
    }
    # Complete over the redistributable set: every version file (including
    # manifest.json) except the display-only editions is inside the archive.
    assert names == on_disk
    assert prefix + "manifest.json" in names
    assert prefix + "tokens.jsonl" in names


def test_tarball_is_deterministic(artifacts: Path) -> None:
    # Rebuilding the archive from the same directory yields byte-identical output:
    # sorted entries, fixed mtime/uid/gid/mode, timestamp-free gzip header.
    version = build_mod.CORPUS_VERSION
    first = build_tarball_bytes(artifacts, version)
    second = build_tarball_bytes(artifacts, version)
    assert first == second

    # Member metadata is normalised (no build-host mtime/uid leaking in).
    with tarfile.open(fileobj=io.BytesIO(first), mode="r:gz") as tar:
        for member in tar.getmembers():
            assert member.mtime == 0
            assert member.uid == 0 and member.gid == 0
            assert member.uname == "" and member.gname == ""


def test_write_full_tarball_excludes_itself(tmp_path: Path) -> None:
    version = "0.6.0"
    d = tmp_path / f"v{version}"
    d.mkdir()
    (d / "manifest.json").write_text("{}", encoding="utf-8")
    (d / "verses.jsonl").write_text("{}\n", encoding="utf-8")

    write_full_tarball(d, version)
    # A second call must not fold the previously written tarball/sidecar into the
    # new archive — the distribution files are excluded from their own contents.
    data = build_tarball_bytes(d, version)
    with tarfile.open(fileobj=io.BytesIO(data), mode="r:gz") as tar:
        names = {m.name for m in tar.getmembers()}
    assert f"quranbench-corpus-v{version}/{full_tarball_name(version)}" not in names
    assert (
        f"quranbench-corpus-v{version}/{full_tarball_sha_name(version)}" not in names
    )
