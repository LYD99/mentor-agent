#!/bin/bash

# Mentor Agent - 发布准备脚本
# 用于将项目从 go-work 仓库中提取为独立仓库

set -e

echo "🚀 Mentor Agent 发布准备脚本"
echo "================================"
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查是否在正确的目录
if [ ! -f "package.json" ] || [ ! -d "app" ]; then
    echo -e "${RED}错误: 请在 mentor-agent 目录下运行此脚本${NC}"
    exit 1
fi

# 检查是否安装了 git-filter-repo
if ! command -v git-filter-repo &> /dev/null; then
    echo -e "${YELLOW}警告: 未安装 git-filter-repo${NC}"
    echo "请先安装: brew install git-filter-repo"
    echo "或: pip3 install git-filter-repo"
    exit 1
fi

# 询问用户选择方案
echo "请选择发布方案:"
echo "1) 保留完整 Git 历史 (推荐)"
echo "2) 全新开始 (丢失历史)"
read -p "请输入选项 (1 或 2): " choice

case $choice in
    1)
        echo -e "${GREEN}选择方案 1: 保留完整 Git 历史${NC}"
        METHOD="filter-repo"
        ;;
    2)
        echo -e "${GREEN}选择方案 2: 全新开始${NC}"
        METHOD="fresh"
        ;;
    *)
        echo -e "${RED}无效选项${NC}"
        exit 1
        ;;
esac

# 询问目标目录
read -p "请输入新仓库目录路径 (默认: /tmp/mentor-agent-new): " TARGET_DIR
TARGET_DIR=${TARGET_DIR:-/tmp/mentor-agent-new}

# 询问 GitHub 仓库 URL
read -p "请输入 GitHub 仓库 URL (例如: https://github.com/username/mentor-agent.git): " REPO_URL

if [ -z "$REPO_URL" ]; then
    echo -e "${YELLOW}警告: 未提供仓库 URL，稍后需要手动添加${NC}"
fi

echo ""
echo "配置确认:"
echo "  方案: $METHOD"
echo "  目标目录: $TARGET_DIR"
echo "  仓库 URL: ${REPO_URL:-未设置}"
echo ""
read -p "确认继续? (y/n): " confirm

if [ "$confirm" != "y" ]; then
    echo "已取消"
    exit 0
fi

# 创建目标目录
if [ -d "$TARGET_DIR" ]; then
    echo -e "${YELLOW}目标目录已存在，将被删除${NC}"
    read -p "确认删除? (y/n): " confirm_delete
    if [ "$confirm_delete" != "y" ]; then
        echo "已取消"
        exit 0
    fi
    rm -rf "$TARGET_DIR"
fi

mkdir -p "$TARGET_DIR"

if [ "$METHOD" = "filter-repo" ]; then
    echo ""
    echo "步骤 1: 克隆原仓库..."
    PARENT_DIR=$(dirname "$(pwd)")
    git clone "$PARENT_DIR" "$TARGET_DIR"
    
    echo ""
    echo "步骤 2: 提取 mentor-agent 子目录..."
    cd "$TARGET_DIR"
    git filter-repo --path mentor-agent/ --path-rename mentor-agent/:
    
    echo ""
    echo "步骤 3: 清理不需要的文件..."
    # 删除个人笔记等
    if [ -d "mythinking" ]; then
        rm -rf mythinking
        git add -A
        git commit -m "chore: remove personal notes" || true
    fi
    
else
    echo ""
    echo "步骤 1: 复制文件..."
    rsync -av --exclude='.git' --exclude='node_modules' --exclude='.next' \
          --exclude='mythinking' --exclude='*.log' \
          "$(pwd)/" "$TARGET_DIR/"
    
    cd "$TARGET_DIR"
    
    echo ""
    echo "步骤 2: 初始化 Git..."
    git init
    git add .
    git commit -m "Initial commit"
fi

echo ""
echo "步骤 4: 运行检查..."

# 检查 lint
echo "运行 lint..."
if pnpm lint; then
    echo -e "${GREEN}✓ Lint 通过${NC}"
else
    echo -e "${YELLOW}⚠ Lint 有警告，请检查${NC}"
fi

# 检查测试
echo "运行测试..."
if pnpm test; then
    echo -e "${GREEN}✓ 测试通过${NC}"
else
    echo -e "${YELLOW}⚠ 测试失败，请检查${NC}"
fi

# 检查构建
echo "运行构建..."
if pnpm build; then
    echo -e "${GREEN}✓ 构建成功${NC}"
else
    echo -e "${RED}✗ 构建失败${NC}"
    exit 1
fi

echo ""
echo "步骤 5: 添加远程仓库..."
if [ -n "$REPO_URL" ]; then
    git remote add origin "$REPO_URL"
    echo -e "${GREEN}✓ 已添加远程仓库${NC}"
else
    echo -e "${YELLOW}⚠ 跳过（未提供仓库 URL）${NC}"
fi

echo ""
echo -e "${GREEN}================================${NC}"
echo -e "${GREEN}✓ 准备完成！${NC}"
echo -e "${GREEN}================================${NC}"
echo ""
echo "新仓库位置: $TARGET_DIR"
echo ""
echo "后续步骤:"
echo "1. 检查文件: cd $TARGET_DIR && ls -la"
echo "2. 查看历史: git log --oneline"
echo "3. 更新 package.json 中的作者和仓库信息"
echo "4. 检查 .env.example 确保无敏感信息"
echo "5. 推送到 GitHub:"
if [ -n "$REPO_URL" ]; then
    echo "   git branch -M main"
    echo "   git push -u origin main"
else
    echo "   git remote add origin <your-repo-url>"
    echo "   git branch -M main"
    echo "   git push -u origin main"
fi
echo "6. 在 GitHub 创建 Release (v0.1.0)"
echo ""
echo "详细文档: docs/PUBLISHING.md"
