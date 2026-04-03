-- Migration Script: v2.4 → v2.5
-- Date: 2026-04-03
-- Description: 重构成长地图为三层结构，移除 GrowthGoal，添加 DailyPlan

-- ========================================
-- Step 1: 创建新表 DailyPlan
-- ========================================
CREATE TABLE IF NOT EXISTS "DailyPlan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "mapId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "planDate" DATETIME NOT NULL,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "DailyPlan_mapId_planDate_key" ON "DailyPlan"("mapId", "planDate");
CREATE INDEX "DailyPlan_taskId_idx" ON "DailyPlan"("taskId");
CREATE INDEX "DailyPlan_planDate_idx" ON "DailyPlan"("planDate");

-- ========================================
-- Step 2: 创建新表 LearningTask（临时）
-- ========================================
CREATE TABLE IF NOT EXISTS "LearningTask" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "stageId" TEXT NOT NULL,
    "taskOrder" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL,
    "durationDays" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LearningTask_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "GrowthStage" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "LearningTask_stageId_taskOrder_idx" ON "LearningTask"("stageId", "taskOrder");
CREATE INDEX "LearningTask_status_idx" ON "LearningTask"("status");

-- ========================================
-- Step 3: 迁移数据 GrowthTask → LearningTask
-- ========================================
-- 将 GrowthTask 的数据迁移到 LearningTask，同时更新 stageId
INSERT INTO "LearningTask" (
    "id", "stageId", "taskOrder", "title", "description", 
    "type", "durationDays", "status", "completedAt", "createdAt", "updatedAt"
)
SELECT 
    gt."id",
    gg."stageId",
    gt."taskOrder",
    gt."title",
    gt."description",
    gt."type",
    gt."durationDays",
    gt."status",
    gt."completedAt",
    gt."createdAt",
    CURRENT_TIMESTAMP as "updatedAt"
FROM "GrowthTask" gt
INNER JOIN "GrowthGoal" gg ON gt."goalId" = gg."id";

-- ========================================
-- Step 4: 更新 LearningLesson 外键
-- ========================================
-- SQLite 不支持直接修改外键，需要重建表

-- 4.1 创建临时表
CREATE TABLE "LearningLesson_new" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "taskId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "contentMarkdown" TEXT NOT NULL,
    "sourcesJson" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LearningLesson_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "LearningTask" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- 4.2 复制数据
INSERT INTO "LearningLesson_new" 
SELECT * FROM "LearningLesson";

-- 4.3 删除旧表
DROP TABLE "LearningLesson";

-- 4.4 重命名新表
ALTER TABLE "LearningLesson_new" RENAME TO "LearningLesson";

-- 4.5 重建索引
CREATE INDEX "LearningLesson_taskId_idx" ON "LearningLesson"("taskId");
CREATE INDEX "LearningLesson_taskId_version_idx" ON "LearningLesson"("taskId", "version");

-- ========================================
-- Step 5: 更新 GrowthStage（移除 goals 关联）
-- ========================================
-- SQLite 不需要显式移除关联，删除 GrowthGoal 表即可

-- ========================================
-- Step 6: 删除旧表 GrowthGoal 和 GrowthTask
-- ========================================
DROP TABLE IF EXISTS "GrowthTask";
DROP TABLE IF EXISTS "GrowthGoal";

-- ========================================
-- Step 7: 更新 GrowthMap（移除字段）
-- ========================================
-- SQLite 不支持 ALTER TABLE DROP COLUMN，需要重建表

-- 7.1 创建临时表
CREATE TABLE "GrowthMap_new" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GrowthMap_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- 7.2 复制数据（不包含 learningPlanJson 和 schedulePreferences）
INSERT INTO "GrowthMap_new" ("id", "userId", "title", "description", "status", "createdAt", "updatedAt")
SELECT "id", "userId", "title", "description", "status", "createdAt", "updatedAt"
FROM "GrowthMap";

-- 7.3 删除旧表
DROP TABLE "GrowthMap";

-- 7.4 重命名新表
ALTER TABLE "GrowthMap_new" RENAME TO "GrowthMap";

-- ========================================
-- Step 8: 更新 ScheduledTask（移除外键约束）
-- ========================================
-- SQLite 需要重建表来移除外键

-- 8.1 创建临时表
CREATE TABLE "ScheduledTask_new" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "mapId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "taskType" TEXT NOT NULL,
    "cronExpression" TEXT NOT NULL,
    "contentJson" TEXT,
    "status" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 8.2 复制数据
INSERT INTO "ScheduledTask_new" 
SELECT * FROM "ScheduledTask";

-- 8.3 删除旧表
DROP TABLE "ScheduledTask";

-- 8.4 重命名新表
ALTER TABLE "ScheduledTask_new" RENAME TO "ScheduledTask";

-- 8.5 重建索引
CREATE INDEX "ScheduledTask_mapId_status_idx" ON "ScheduledTask"("mapId", "status");
CREATE INDEX "ScheduledTask_userId_status_idx" ON "ScheduledTask"("userId", "status");
CREATE INDEX "ScheduledTask_status_idx" ON "ScheduledTask"("status");

-- ========================================
-- Step 9: 更新 LearningMaterial（添加 dailyPlanId）
-- ========================================
-- SQLite 支持 ALTER TABLE ADD COLUMN
ALTER TABLE "LearningMaterial" ADD COLUMN "dailyPlanId" TEXT;

-- 创建索引
CREATE INDEX "LearningMaterial_dailyPlanId_idx" ON "LearningMaterial"("dailyPlanId");

-- 更新复合索引
DROP INDEX IF EXISTS "LearningMaterial_userId_type_idx";
DROP INDEX IF EXISTS "LearningMaterial_userId_createdAt_idx";
CREATE INDEX "LearningMaterial_userId_type_createdAt_idx" ON "LearningMaterial"("userId", "type", "createdAt");

-- ========================================
-- Step 10: 重建 GrowthStage 索引
-- ========================================
CREATE INDEX "GrowthStage_mapId_stageOrder_idx" ON "GrowthStage"("mapId", "stageOrder");

-- ========================================
-- Migration Complete
-- ========================================
-- 注意事项：
-- 1. 此脚本会删除 GrowthGoal 表，Goal 信息将丢失
-- 2. learningPlanJson 数据将丢失，需要重新生成学习计划
-- 3. 建议在执行前备份数据库
-- 4. 执行后需要运行 `npx prisma generate` 更新 Prisma Client
