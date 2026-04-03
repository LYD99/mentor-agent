#!/bin/bash

# v2.5 数据库重建脚本
# 用途：清空旧数据库，重新生成新的 schema

set -e  # 遇到错误立即退出

echo "🗑️  删除旧数据库..."
rm -f mentor-agent/prisma/data/app.db
rm -f mentor-agent/prisma/data/app.db-journal

echo "📦 重新生成 Prisma Client..."
cd mentor-agent
npx prisma generate

echo "🔨 创建新数据库（使用 v2.5 schema）..."
npx prisma db push --skip-generate

echo "✅ 数据库重建完成！"
echo ""
echo "📝 新的数据库结构："
echo "   - GrowthMap (移除 learningPlanJson, schedulePreferences)"
echo "   - GrowthStage"
echo "   - LearningTask (原 GrowthTask，直接关联 Stage)"
echo "   - LearningLesson"
echo "   - DailyPlan (新增)"
echo "   - ScheduledTask"
echo "   - LearningMaterial (新增 dailyPlanId)"
echo ""
echo "🚀 可以启动应用了：pnpm dev"
