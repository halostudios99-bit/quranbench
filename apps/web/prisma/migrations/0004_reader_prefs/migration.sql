-- Reading preferences on the account (Batch 1, reader controls). A convenience
-- mirror of the reader's translation selection, display mode and Arabic size so
-- the same choices follow a signed-in reader across devices. Never gates content.
ALTER TABLE "User" ADD COLUMN "readerPrefs" JSONB;
