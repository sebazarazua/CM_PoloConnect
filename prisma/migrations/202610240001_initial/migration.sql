-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "StateStore" (
    "id" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "data" JSONB NOT NULL,

    CONSTRAINT "StateStore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NewsEvent" (
    "id" TEXT NOT NULL,
    "logicalKey" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "sourceKeys" TEXT[],
    "data" JSONB NOT NULL,
    "history" JSONB NOT NULL,

    CONSTRAINT "NewsEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentItem" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "objective" TEXT NOT NULL,
    "audienceJob" TEXT NOT NULL,
    "priority" TEXT NOT NULL,
    "opportunityScore" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "versions" JSONB NOT NULL,
    "blockers" JSONB NOT NULL,

    CONSTRAINT "ContentItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Opportunity" (
    "id" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "data" JSONB NOT NULL,

    CONSTRAINT "Opportunity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreativePlan" (
    "id" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "stale" BOOLEAN NOT NULL,
    "inputHash" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreativePlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CopyVersion" (
    "id" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "stale" BOOLEAN NOT NULL,
    "inputHash" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CopyVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetVersion" (
    "id" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "stale" BOOLEAN NOT NULL,
    "inputHash" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssetVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetadataVersion" (
    "id" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "stale" BOOLEAN NOT NULL,
    "inputHash" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MetadataVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QualityReview" (
    "id" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "stale" BOOLEAN NOT NULL,
    "inputHash" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QualityReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Approval" (
    "id" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "approver" TEXT,
    "at" TIMESTAMP(3) NOT NULL,
    "versions" JSONB NOT NULL,
    "packageHash" TEXT NOT NULL,
    "data" JSONB NOT NULL,

    CONSTRAINT "Approval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Publication" (
    "id" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "externalId" TEXT,
    "status" TEXT NOT NULL,
    "versions" JSONB NOT NULL,
    "payload" JSONB NOT NULL,
    "data" JSONB NOT NULL,

    CONSTRAINT "Publication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PerformanceSnapshot" (
    "id" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "observedAt" TIMESTAMP(3) NOT NULL,
    "metrics" JSONB NOT NULL,
    "definitions" JSONB NOT NULL,
    "data" JSONB NOT NULL,

    CONSTRAINT "PerformanceSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Learning" (
    "id" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "statement" TEXT NOT NULL,
    "maturity" TEXT NOT NULL,
    "confidence" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "evidence" JSONB NOT NULL,
    "nextTest" TEXT,
    "data" JSONB NOT NULL,

    CONSTRAINT "Learning_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowRun" (
    "id" TEXT NOT NULL,
    "contentId" TEXT,
    "skill" TEXT NOT NULL,
    "inputHash" TEXT NOT NULL,
    "knowledgeHash" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3) NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "attempt" INTEGER NOT NULL,
    "input" JSONB NOT NULL,
    "output" JSONB NOT NULL,
    "data" JSONB NOT NULL,

    CONSTRAINT "WorkflowRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "contentId" TEXT,
    "kind" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL,
    "data" JSONB NOT NULL,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EditorialPlan" (
    "id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "data" JSONB NOT NULL,
    "at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EditorialPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BenchmarkRecord" (
    "id" TEXT NOT NULL,
    "data" JSONB NOT NULL,

    CONSTRAINT "BenchmarkRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NewsEvent_logicalKey_key" ON "NewsEvent"("logicalKey");

-- CreateIndex
CREATE INDEX "ContentItem_status_priority_idx" ON "ContentItem"("status", "priority");

-- CreateIndex
CREATE UNIQUE INDEX "Opportunity_contentId_key" ON "Opportunity"("contentId");

-- CreateIndex
CREATE UNIQUE INDEX "CreativePlan_contentId_version_key" ON "CreativePlan"("contentId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "CopyVersion_contentId_version_key" ON "CopyVersion"("contentId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "AssetVersion_contentId_version_key" ON "AssetVersion"("contentId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "MetadataVersion_contentId_version_key" ON "MetadataVersion"("contentId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "QualityReview_contentId_version_key" ON "QualityReview"("contentId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "Publication_idempotencyKey_key" ON "Publication"("idempotencyKey");

-- CreateIndex
CREATE INDEX "WorkflowRun_skill_inputHash_status_idx" ON "WorkflowRun"("skill", "inputHash", "status");

-- CreateIndex
CREATE INDEX "AuditEvent_contentId_at_idx" ON "AuditEvent"("contentId", "at");

-- CreateIndex
CREATE UNIQUE INDEX "EditorialPlan_version_key" ON "EditorialPlan"("version");

-- AddForeignKey
ALTER TABLE "ContentItem" ADD CONSTRAINT "ContentItem_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "NewsEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "ContentItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreativePlan" ADD CONSTRAINT "CreativePlan_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "ContentItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CopyVersion" ADD CONSTRAINT "CopyVersion_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "ContentItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetVersion" ADD CONSTRAINT "AssetVersion_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "ContentItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetadataVersion" ADD CONSTRAINT "MetadataVersion_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "ContentItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QualityReview" ADD CONSTRAINT "QualityReview_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "ContentItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Approval" ADD CONSTRAINT "Approval_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "ContentItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Publication" ADD CONSTRAINT "Publication_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "ContentItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PerformanceSnapshot" ADD CONSTRAINT "PerformanceSnapshot_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "ContentItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Learning" ADD CONSTRAINT "Learning_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "ContentItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowRun" ADD CONSTRAINT "WorkflowRun_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "ContentItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

