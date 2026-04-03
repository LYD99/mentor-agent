-- CreateTable
CREATE TABLE "ExternalBot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "description" TEXT,
    "webhookUrl" TEXT,
    "appId" TEXT,
    "appSecret" TEXT,
    "token" TEXT,
    "aesKey" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "config" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "ExternalBot_platform_idx" ON "ExternalBot"("platform");
CREATE INDEX "ExternalBot_enabled_idx" ON "ExternalBot"("enabled");
