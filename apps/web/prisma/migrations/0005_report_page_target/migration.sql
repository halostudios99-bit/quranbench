-- A correction report can target a public page (verse, word, root, investigation),
-- not only an investigation or a response. targetId holds the reported page path.
-- Corrections to Quranic text are impossible by design; a PAGE report concerns
-- annotations, translations or editorial content.
ALTER TYPE "ReportTargetType" ADD VALUE 'PAGE';
