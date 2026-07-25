# corpus-build

Offline pipeline that turns Tanzil Quran text editions into versioned,
checksummed corpus artifacts. Standard library only — no third-party runtime
dependencies.

## Run

```bash
cd packages/corpus-build
python -m pipeline.fetch      # download + checksum-verify sources into sources/
python -m pipeline.build      # write out/v0.1.0/
```

`build` runs `fetch` first, so `python -m pipeline.build` alone is enough for a
clean build. Sources already present with a matching SHA-256 are not
re-downloaded.

## Test

```bash
cd packages/corpus-build
pip install -e ".[dev]"       # once
pytest
```

Tests run against the real, checksum-verified sources in `sources/`. If those
files are absent the source-dependent tests skip with an instruction to fetch.

## Output

`out/v0.1.0/` — `sources.json`, `surahs.json`, `verses.jsonl`, `manifest.json`.
Every text field's provenance and every normalisation rule applied is recorded
in `manifest.json`; the artifacts are reproducible from the manifest and the
checksummed sources.

## Scope

Verses only. Token segmentation, morphology, roots and translations are later
stages and are intentionally absent.
