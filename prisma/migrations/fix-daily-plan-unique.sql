-- 修复 DailyPlan 唯一约束，允许同一天有多个任务
-- 从 unique(mapId, planDate) 改为 unique(mapId, taskId, planDate)

-- 1. 删除旧的唯一索引
DROP INDEX IF EXISTS "DailyPlan_mapId_planDate_key";

-- 2. 创建新的唯一索引
CREATE UNIQUE INDEX "DailyPlan_mapId_taskId_planDate_key" ON "DailyPlan"("mapId", "taskId", "planDate");

-- 3. 创建新的复合索引以优化查询
CREATE INDEX IF NOT EXISTS "DailyPlan_mapId_planDate_idx" ON "DailyPlan"("mapId", "planDate");
