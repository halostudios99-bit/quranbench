-- Editorial prose for an investigation (Prompt 13, Part C). The structured slots
-- (claim / query / counterEvidence) carry the argument; this optional column
-- preserves the long-form article body an investigation was seeded from.
ALTER TABLE "Investigation" ADD COLUMN "body" TEXT;
