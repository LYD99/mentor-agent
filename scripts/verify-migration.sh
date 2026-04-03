#!/bin/bash

# 消息流模式迁移验证脚本
# 运行方式: bash scripts/verify-migration.sh

echo "🔍 开始验证消息流模式迁移..."
echo ""

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查计数器
PASSED=0
FAILED=0

# 1. 检查数据库文件
echo "1️⃣ 检查数据库文件..."
if [ -f "prisma/data/app.db" ] || [ -f "prisma/prisma/data/app.db" ]; then
    echo -e "   ${GREEN}✅ 数据库文件存在${NC}"
    PASSED=$((PASSED + 1))
else
    echo -e "   ${RED}❌ 数据库文件不存在${NC}"
    FAILED=$((FAILED + 1))
fi
echo ""

# 2. 检查核心文件是否存在
echo "2️⃣ 检查核心文件..."
FILES=(
    "lib/storage/chat-dual-write.ts"
    "lib/ai/stream-chat.ts"
    "app/api/lesson/regenerate/route.ts"
    "scripts/test-message-stream.ts"
    "scripts/migrate-to-message-stream.ts"
)

for file in "${FILES[@]}"; do
    if [ -f "$file" ]; then
        echo -e "   ${GREEN}✅ $file${NC}"
        PASSED=$((PASSED + 1))
    else
        echo -e "   ${RED}❌ $file 不存在${NC}"
        FAILED=$((FAILED + 1))
    fi
done
echo ""

# 3. 检查旧文件是否已删除
echo "3️⃣ 检查旧文件..."
DELETED_FILES=(
    "app/api/tool-calls/retry/route.ts"
    "lib/storage/chat-dual-write-v2.ts"
    "lib/ai/stream-chat-v2.ts"
    "lib/storage/tool-call-tracker.ts"
)

for file in "${DELETED_FILES[@]}"; do
    if [ ! -f "$file" ]; then
        echo -e "   ${GREEN}✅ $file 已删除${NC}"
        PASSED=$((PASSED + 1))
    else
        echo -e "   ${YELLOW}⚠️  $file 仍然存在（应该删除）${NC}"
        FAILED=$((FAILED + 1))
    fi
done
echo ""

# 4. 检查 Prisma Schema
echo "4️⃣ 检查 Prisma Schema..."
if ! grep -q "model ToolCallExecution" prisma/schema.prisma; then
    echo -e "   ${GREEN}✅ ToolCallExecution 已删除${NC}"
    PASSED=$((PASSED + 1))
else
    echo -e "   ${YELLOW}⚠️  ToolCallExecution 仍然存在${NC}"
fi

if grep -q "消息流模式" prisma/schema.prisma; then
    echo -e "   ${GREEN}✅ Schema 已更新为消息流模式${NC}"
    PASSED=$((PASSED + 1))
else
    echo -e "   ${YELLOW}⚠️  Schema 可能未更新注释${NC}"
fi
echo ""

# 5. 运行消息流测试
echo "5️⃣ 运行消息流测试..."
if npm run test:message-stream > /tmp/test-output.log 2>&1; then
    echo -e "   ${GREEN}✅ 消息流测试通过${NC}"
    PASSED=$((PASSED + 1))
else
    echo -e "   ${RED}❌ 消息流测试失败${NC}"
    echo "   查看详细日志: cat /tmp/test-output.log"
    FAILED=$((FAILED + 1))
fi
echo ""

# 6. 检查 package.json 脚本
echo "6️⃣ 检查 package.json 脚本..."
if grep -q "migrate:message-stream" package.json; then
    echo -e "   ${GREEN}✅ 迁移脚本已添加${NC}"
    PASSED=$((PASSED + 1))
else
    echo -e "   ${RED}❌ 迁移脚本未添加${NC}"
    FAILED=$((FAILED + 1))
fi

if grep -q "test:message-stream" package.json; then
    echo -e "   ${GREEN}✅ 测试脚本已添加${NC}"
    PASSED=$((PASSED + 1))
else
    echo -e "   ${RED}❌ 测试脚本未添加${NC}"
    FAILED=$((FAILED + 1))
fi
echo ""

# 7. 检查文档
echo "7️⃣ 检查文档..."
DOCS=(
    "MIGRATION_FINAL.md"
    "docs/message-stream-comparison.md"
)

for doc in "${DOCS[@]}"; do
    if [ -f "$doc" ]; then
        echo -e "   ${GREEN}✅ $doc${NC}"
        PASSED=$((PASSED + 1))
    else
        echo -e "   ${RED}❌ $doc 不存在${NC}"
        FAILED=$((FAILED + 1))
    fi
done
echo ""

# 总结
echo "=========================================="
echo "📊 验证结果:"
echo -e "   ${GREEN}✅ 通过: $PASSED${NC}"
echo -e "   ${RED}❌ 失败: $FAILED${NC}"
echo "=========================================="
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 迁移验证通过！系统已成功升级到消息流模式。${NC}"
    echo ""
    echo "下一步："
    echo "  1. 启动开发服务器: npm run dev"
    echo "  2. 测试聊天功能"
    echo "  3. 检查消息流显示是否正常"
    echo ""
    exit 0
else
    echo -e "${RED}⚠️  迁移验证失败，请检查上述错误。${NC}"
    echo ""
    exit 1
fi
