-- AlterTable
ALTER TABLE "ContentItem" ADD COLUMN     "workflowClass" TEXT;

-- AlterTable
ALTER TABLE "WorkflowRun" ADD COLUMN     "actualCostUsd" DOUBLE PRECISION,
ADD COLUMN     "budgetCharge" JSONB,
ADD COLUMN     "cachedInputTokens" INTEGER,
ADD COLUMN     "costSource" TEXT,
ADD COLUMN     "costUsd" DOUBLE PRECISION,
ADD COLUMN     "estimatedCostUsd" DOUBLE PRECISION,
ADD COLUMN     "estimatedInputTokens" INTEGER,
ADD COLUMN     "inputTokens" INTEGER,
ADD COLUMN     "latencyMs" INTEGER,
ADD COLUMN     "llmCall" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "model" TEXT,
ADD COLUMN     "outputTokens" INTEGER,
ADD COLUMN     "provider" TEXT,
ADD COLUMN     "reasoningTokens" INTEGER,
ADD COLUMN     "selectedReferences" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "totalTokens" INTEGER,
ADD COLUMN     "workflowClass" TEXT,
ADD COLUMN     "workflowId" TEXT;

-- CreateIndex
CREATE INDEX "WorkflowRun_workflowId_startedAt_idx" ON "WorkflowRun"("workflowId", "startedAt");

-- CreateIndex
CREATE INDEX "WorkflowRun_workflowClass_model_startedAt_idx" ON "WorkflowRun"("workflowClass", "model", "startedAt");

