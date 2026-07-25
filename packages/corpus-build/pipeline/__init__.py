"""Offline Quran corpus build pipeline.

Stages, in order:

    fetch      download + checksum-verify the raw Tanzil editions
    parse      Tanzil ``sura|aya|text`` records -> structured verses
    normalise  derive labelled text fields without mutating the source
    basmala    separate the surah-opening basmala from verse 1
    segment    split verse text into whitespace-delimited word tokens
    build      write versioned artifacts under ``out/<version>/``

Tokens and verses. Morphology (prefix/suffix segmentation) and translations are
later prompts.
"""

CORPUS_VERSION = "0.2.0"
WORK_ID = "quran"
SEGMENTATION_SCHEME = "tanzil-uthmani"
