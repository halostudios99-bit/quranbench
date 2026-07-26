# Zenodo deposit

Zenodo gives a corpus version a DOI and an archived copy that outlives the
project. This is the difference the extensibility doc draws between infrastructure
and a website: a website disappears when the server is turned off; a dataset with a
DOI on Zenodo survives it. Deposit every released corpus version.

## What the packager does

`scripts/zenodo-package.mjs` assembles a self-contained, self-verifying deposit for
one corpus version. It **uploads nothing** — there are no credentials in this
repo — it only prepares the files so the deposit is a short manual procedure.

```
node scripts/zenodo-package.mjs 0.8.0     # or omit the version for the latest on disk
```

Output: `zenodo-deposit/quranbench-corpus-v<version>/`, containing:

- `quranbench-corpus-v<version>.tar.gz` (+ `.sha256`) — the redistributable corpus.
- `manifest.json`, `sources.json` — provenance and per-artifact checksums.
- `CITATION.cff` — citation metadata (GitHub renders it; other tools read it).
- `zenodo.json` — Zenodo deposition metadata (title, description, keywords,
  related identifiers, mixed-licence note).
- `README.md` — a researcher-facing description of the dataset.
- `LICENSES/` — every upstream licence and attribution file, verbatim.
- `CHECKSUMS.sha256` — a SHA-256 for every file in the deposit.

Verify the package before depositing:

```
cd zenodo-deposit/quranbench-corpus-v<version>
shasum -a 256 -c CHECKSUMS.sha256
```

## Manual deposit steps

1. **Account.** Sign in at <https://zenodo.org> (ORCID or GitHub works). For the
   first deposit, consider creating a **community** (e.g. "quranbench") so every
   version groups together.
2. **New upload.** Dashboard → _New upload_. Upload the whole contents of the
   package directory (drag the files in), or at minimum the tarball, `README.md`,
   `manifest.json`, `sources.json`, `CITATION.cff` and the `LICENSES/` files.
3. **Metadata.** Fill the form from `zenodo.json`:
   - _Upload type_: **Dataset**.
   - _Title_: `quranbench corpus, v<version>`.
   - _Version_: `<version>`.
   - _Description_: paste the HTML description from `zenodo.json`.
   - _Keywords_: from `zenodo.json`.
   - _License_: the licensing is mixed — set the license to **Other (Open)** and
     rely on the README and `LICENSES/` for the exact per-component terms (Tanzil
     text CC BY 3.0; Leeds QAC morphology and anything embedding it GPL-2.0-or-later;
     translations per edition). Do **not** pick a single SPDX license that would
     misstate the morphology's copyleft.
   - _Related/alternate identifiers_: add the upstream URLs from `zenodo.json`
     (`isDerivedFrom`) and `https://quranbench.com` (`isSupplementTo`).
4. **Reserve a DOI** (optional) if you want to reference it before publishing.
5. **Publish.** Publishing is **irreversible** and the files become permanent — do
   it only for a released version you will not change. A correction is a _new
   version_ of the same Zenodo record (use _New version_), never an edit.
6. **Record the DOI.** Put the concept DOI (all versions) and the version DOI in
   the site's `/data` and `/method` pages and in `docs/licensing.md`, so the
   citation the site shows resolves to the archived copy.

## Versioning

- One Zenodo record per corpus **concept**, with a new _version_ for each released
  corpus version — the concept DOI always resolves to the latest, a version DOI to
  a specific one.
- Because the corpus is immutable once released (a correction is a new version),
  each deposit is final. This matches the project's reproducibility promise: a
  citation naming v0.8.0 resolves forever to exactly those bytes.
