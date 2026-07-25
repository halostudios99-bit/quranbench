"""Offline Quran corpus build pipeline.

Stages, in order:

    fetch      download + checksum-verify the raw Tanzil editions
    parse      Tanzil ``sura|aya|text`` records -> structured verses
    normalise  derive labelled text fields without mutating the source
    basmala    separate the surah-opening basmala from verse 1
    segment    split verse text into whitespace-delimited word tokens
    morphology align the Leeds QAC morphology onto tokens (annotation layer)
    build      write versioned artifacts under ``out/<version>/``

Tokens, verses and morphology. Translations are a later prompt.
"""

CORPUS_VERSION = "0.5.0"
WORK_ID = "quran"
SEGMENTATION_SCHEME = "tanzil-uthmani"
