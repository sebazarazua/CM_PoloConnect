ALTER TABLE "Publication"
  ADD COLUMN "accountId" TEXT,
  ADD COLUMN "containerId" TEXT,
  ADD COLUMN "igMediaId" TEXT,
  ADD COLUMN "permalink" TEXT,
  ADD COLUMN "publicationPackageHash" TEXT,
  ADD COLUMN "captionVersion" INTEGER,
  ADD COLUMN "assetVersion" INTEGER;
CREATE INDEX "Publication_provider_accountId_status_idx" ON "Publication"("provider", "accountId", "status");
