"""Offline Quran corpus build pipeline.

Stages, in order:

    fetch      download + checksum-verify the raw Tanzil editions
    parse      Tanzil ``sura|aya|text`` records -> structured verses
    normalise  derive labelled text fields without mutating the source
    basmala    separate the surah-opening basmala from verse 1
    segment    split verse text into whitespace-delimited word tokens
    morphology align the Leeds QAC morphology onto tokens (annotation layer)
    translations ingest verse-level licensed translation editions (v0.6.0)
    build      write versioned artifacts under ``out/<version>/``

Tokens, verses, morphology and verse-level translations.
"""

CORPUS_VERSION = "0.6.0"
WORK_ID = "quran"
SEGMENTATION_SCHEME = "tanzil-uthmani"
