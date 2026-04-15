-- CreateTable
CREATE TABLE "mutes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "muteStartTime" BIGINT NOT NULL,
    "muteEndTime" BIGINT NOT NULL,
    "reason" TEXT,
    "muteRoleId" TEXT NOT NULL,
    "mutedBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "moderation_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "reason" TEXT,
    "moderatorId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "mutes_guildId_idx" ON "mutes"("guildId");

-- CreateIndex
CREATE INDEX "mutes_userId_idx" ON "mutes"("userId");

-- CreateIndex
CREATE INDEX "mutes_muteEndTime_idx" ON "mutes"("muteEndTime");

-- CreateIndex
CREATE UNIQUE INDEX "mutes_guildId_userId_key" ON "mutes"("guildId", "userId");

-- CreateIndex
CREATE INDEX "moderation_logs_guildId_idx" ON "moderation_logs"("guildId");

-- CreateIndex
CREATE INDEX "moderation_logs_userId_idx" ON "moderation_logs"("userId");

-- CreateIndex
CREATE INDEX "moderation_logs_action_idx" ON "moderation_logs"("action");

-- CreateIndex
CREATE INDEX "moderation_logs_createdAt_idx" ON "moderation_logs"("createdAt");
