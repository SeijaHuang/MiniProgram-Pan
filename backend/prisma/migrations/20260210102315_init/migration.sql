-- CreateEnum
CREATE TYPE "ELlmTaskStatus" AS ENUM ('queued', 'running', 'succeeded', 'failed');

-- CreateTable
CREATE TABLE "llm_tasks" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "status" "ELlmTaskStatus" NOT NULL DEFAULT 'queued',
    "hostText" TEXT NOT NULL,
    "participantText" TEXT NOT NULL,
    "resultJson" JSONB,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "llm_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "room_llm_locks" (
    "roomId" TEXT NOT NULL,
    "lockedTaskId" TEXT NOT NULL,
    "lockedUntil" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "room_llm_locks_pkey" PRIMARY KEY ("roomId")
);

-- CreateIndex
CREATE UNIQUE INDEX "llm_tasks_idempotencyKey_key" ON "llm_tasks"("idempotencyKey");

-- CreateIndex
CREATE INDEX "llm_tasks_status_idx" ON "llm_tasks"("status");

-- CreateIndex
CREATE INDEX "llm_tasks_roomId_idx" ON "llm_tasks"("roomId");
