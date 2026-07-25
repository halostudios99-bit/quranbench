# corpus-build

Offline pipeline that turns Tanzil Quran text editions into versioned,
checksummed corpus artifacts. Standard library only — no third-party runtime
dependencies.

## Run

```bash
cd packages/corpus-build
python -m pipeline.fetch      # download + checksum-verify sources into sources/
python -m pipeline.build      # write out/v0.4.0/
python -m pipeline.verify out/v0.4.0   # confirm artifacts match manifest checksums
```

`build` runs `fetch` first, so `python -m pipeline.build` alone is enough for a
clean build. Sources already present with a matching SHA-256 are not
re-downloaded.

`verify` re-hashes every emitted artifact against the `checksums` block in
`manifest.json` and exits non-zero on any mismatch — this is what an outside
researcher runs to confirm a published corpus is byte-for-byte as built, with no
build step and no trust in the loader. See `docs/architecture.md`.

## Test

```bash
cd packages/corpus-build
pip install -e ".[dev]"       # once
pytest
```

Tests run against the real, checksum-verified sources in `sources/`. If those
files are absent the source-dependent tests skip with an instruction to fetch.

## Output

`out/v0.4.0/` — `sources.json`, `surahs.json`, `verses.jsonl`, `tokens.jsonl`,
`identifiers.json`, `manifest.json`, `mapping/` (version-to-version identifier
mapping schema + the identity `v0.3.0-to-v0.4.0.json`), and `numbering/` (the verse
numbering schemes as data). Every text field's provenance and every normalisation
rule applied is recorded in `manifest.json`, along with a `checksums` block giving
the sha256 and byte size of every other emitted file; the artifacts are
reproducible from the manifest and the checksummed sources, and verifiable
byte-for-byte against the manifest.

v0.4.0 is a metadata-only rebuild of v0.3.0: it adds the output `checksums` block
and nothing else. Segmentation, the 77,881-token count and every identifier are
unchanged, so `mapping/v0.3.0-to-v0.4.0.json` is a pure identity with no entries.

The surah-opening basmala is stored once per surah in `surahs.json` (with its own
token range) rather than merged into verse 1 — see `pipeline/basmala.py`. It is
addressed by the named `basmala` segment slot
(`quran:tanzil-uthmani:2:basmala:1`), never an ordinal — so no permanent
identifier asserts whether it is or is not a verse. Al-Fatiha's basmala remains
verse 1:1, and surah 9 has none.

Verse numbering is a recorded parameter, not a fact baked into identifiers. The
default **Kūfan** scheme reproduces the 6,236-verse count; each verse record
carries an `ordinals` map per scheme, and its stable identity is its surah and
segment slot. See `docs/numbering.md` and `pipeline/numbering.py`.

## Scope

Verses and whitespace-delimited word tokens. Morphological (prefix/suffix)
segmentation, roots and translations are later stages and are intentionally
absent.
