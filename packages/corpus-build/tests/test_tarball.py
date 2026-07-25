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
    tar_path = artifacts / full_tarball_name("0.6.0")
    sha_path = artifacts / full_tarball_sha_name("0.6.0")
    assert tar_path.is_file()
    assert sha_path.is_file()

    # The sidecar records the sha256 of the tarball bytes exactly.
    data = tar_path.read_bytes()
    recorded = sha_path.read_text(encoding="utf-8").split()[0]
    assert recorded == sha256_bytes(data)
    assert recorded == sha256_bytes(tar_path.read_bytes())
    # Sidecar uses the standard "<hash>  <filename>" shasum format.
    assert sha_path.read_text(encoding="utf-8").strip().endswith(
        full_tarball_name("0.6.0")
    )


def test_tarball_contains_the_complete_artifact_set(artifacts: Path) -> None:
    prefix = "quranbench-corpus-v0.6.0/"
    with gzip.open(artifacts / full_tarball_name("0.6.0"), "rb") as gz:
        with tarfile.open(fileobj=io.BytesIO(gz.read()), mode="r") as tar:
            names = {m.name for m in tar.getmembers() if m.isfile()}

    on_disk = {
        prefix + p.relative_to(artifacts).as_posix()
        for p in artifacts.rglob("*")
        if p.is_file()
        and p.name != full_tarball_name("0.6.0")
        and p.name != full_tarball_sha_name("0.6.0")
    }
    # Complete: every version file (including manifest.json) is inside the archive.
    assert names == on_disk
    assert prefix + "manifest.json" in names
    assert prefix + "tokens.jsonl" in names


def test_tarball_is_deterministic(artifacts: Path) -> None:
    # Rebuilding the archive from the same directory yields byte-identical output:
    # sorted entries, fixed mtime/uid/gid/mode, timestamp-free gzip header.
    first = build_tarball_bytes(artifacts, "0.6.0")
    second = build_tarball_bytes(artifacts, "0.6.0")
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
