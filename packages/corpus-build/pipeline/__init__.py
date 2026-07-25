"""Offline Quran corpus build pipeline.

Stages, in order:

    fetch      download + checksum-verify the raw Tanzil editions
    parse      Tanzil ``sura|aya|text`` records -> structured verses
    normalise  derive labelled text fields without mutating the source
    build      write versioned artifacts under ``out/<version>/``

Verses only. Token segmentation, morphology and translations are later prompts.
"""

CORPUS_VERSION = "0.1.0"
WORK_ID = "quran"
SEGMENTATION_SCHEME = "tanzil-uthmani"
