#!/bin/bash

# RAG API 测试脚本
# 使用方法: ./scripts/test-rag-api.sh

BASE_URL="http://localhost:3000"
API_PATH="/api/rag/datasets"

echo "🧪 Testing RAG API Endpoints"
echo "================================"
echo ""

# 注意：需要先登录获取 session cookie
echo "⚠️  Note: You need to be logged in to test these endpoints"
echo "   Please login at http://localhost:3000 first"
echo ""

# 测试 1: 获取知识库列表
echo "1️⃣ Testing GET /api/rag/datasets"
echo "   curl -X GET $BASE_URL$API_PATH"
echo ""

# 测试 2: 创建知识库
echo "2️⃣ Testing POST /api/rag/datasets"
echo "   curl -X POST $BASE_URL$API_PATH \\"
echo "     -H 'Content-Type: application/json' \\"
echo "     -d '{"
echo "       \"name\": \"Test Dataset\","
echo "       \"purpose\": \"Test purpose\","
echo "       \"datasetId\": \"test-uuid\","
echo "       \"apiKey\": \"test-key\","
echo "       \"description\": \"Test description\""
echo "     }'"
echo ""

# 测试 3: 更新知识库
echo "3️⃣ Testing PATCH /api/rag/datasets/[id]"
echo "   curl -X PATCH $BASE_URL$API_PATH/[id] \\"
echo "     -H 'Content-Type: application/json' \\"
echo "     -d '{\"enabled\": false}'"
echo ""

# 测试 4: 测试连接
echo "4️⃣ Testing POST /api/rag/datasets/[id]/test"
echo "   curl -X POST $BASE_URL$API_PATH/[id]/test \\"
echo "     -H 'Content-Type: application/json' \\"
echo "     -d '{\"query\": \"test\"}'"
echo ""

# 测试 5: 删除知识库
echo "5️⃣ Testing DELETE /api/rag/datasets/[id]"
echo "   curl -X DELETE $BASE_URL$API_PATH/[id]"
echo ""

echo "================================"
echo "📝 To run actual tests, copy the curl commands above"
echo "   and replace [id] with an actual dataset ID"
echo ""
echo "💡 Tip: Use the browser's Network tab to get the session cookie"
echo "   Then add: -H 'Cookie: next-auth.session-token=...' to curl commands"
