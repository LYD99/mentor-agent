#!/bin/bash

# Mentor Agent 一键启动脚本
# 用途：检查环境、初始化数据库、启动应用

set -e  # 遇到错误立即退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 打印标题
print_header() {
    echo ""
    echo "╔════════════════════════════════════════════════╗"
    echo "║       Mentor Agent 启动脚本 v1.0              ║"
    echo "╚════════════════════════════════════════════════╝"
    echo ""
}

# 检查 Node.js 版本
check_node() {
    log_info "检查 Node.js 版本..."
    if ! command -v node &> /dev/null; then
        log_error "Node.js 未安装！请先安装 Node.js 18+ 版本"
        exit 1
    fi
    
    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 18 ]; then
        log_error "Node.js 版本过低（当前: $(node -v)），需要 18+ 版本"
        exit 1
    fi
    log_success "Node.js 版本检查通过: $(node -v)"
}

# 检查 pnpm
check_pnpm() {
    log_info "检查 pnpm..."
    if ! command -v pnpm &> /dev/null; then
        log_warning "pnpm 未安装，正在安装..."
        npm install -g pnpm
        log_success "pnpm 安装完成"
    else
        log_success "pnpm 已安装: $(pnpm -v)"
    fi
}

# 检查环境变量文件
check_env() {
    log_info "检查环境变量配置..."
    if [ ! -f .env ]; then
        log_warning ".env 文件不存在，正在从模板创建..."
        if [ -f .env.example ]; then
            cp .env.example .env
            log_success "已创建 .env 文件"
        else
            log_error ".env.example 文件不存在！"
            exit 1
        fi
    else
        log_success ".env 文件已存在"
    fi
    
    # 自动生成 AUTH_SECRET（如果未配置）
    if ! grep -q "^AUTH_SECRET=" .env || grep -q "^AUTH_SECRET=your-secret-here" .env || grep -q "^AUTH_SECRET=$" .env; then
        log_info "自动生成 AUTH_SECRET..."
        AUTH_SECRET=$(openssl rand -base64 32 2>/dev/null || node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")
        if grep -q "^AUTH_SECRET=" .env; then
            # 替换现有行
            if [[ "$OSTYPE" == "darwin"* ]]; then
                sed -i '' "s|^AUTH_SECRET=.*|AUTH_SECRET=$AUTH_SECRET|" .env
            else
                sed -i "s|^AUTH_SECRET=.*|AUTH_SECRET=$AUTH_SECRET|" .env
            fi
        else
            # 添加新行
            echo "AUTH_SECRET=$AUTH_SECRET" >> .env
        fi
        log_success "AUTH_SECRET 已自动生成"
    fi
    
    # 自动生成 ENCRYPTION_KEY（如果未配置）
    if ! grep -q "^ENCRYPTION_KEY=" .env || grep -q "^ENCRYPTION_KEY=your-64-char-hex-key-here" .env || grep -q "^ENCRYPTION_KEY=$" .env; then
        log_info "自动生成 ENCRYPTION_KEY..."
        ENCRYPTION_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
        if grep -q "^ENCRYPTION_KEY=" .env; then
            # 替换现有行
            if [[ "$OSTYPE" == "darwin"* ]]; then
                sed -i '' "s|^ENCRYPTION_KEY=.*|ENCRYPTION_KEY=$ENCRYPTION_KEY|" .env
            else
                sed -i "s|^ENCRYPTION_KEY=.*|ENCRYPTION_KEY=$ENCRYPTION_KEY|" .env
            fi
        else
            # 添加新行（在合适的位置）
            if grep -q "^# ENCRYPTION" .env; then
                # 如果有 ENCRYPTION 注释，在其后添加
                if [[ "$OSTYPE" == "darwin"* ]]; then
                    sed -i '' "/^# ENCRYPTION/a\\
ENCRYPTION_KEY=$ENCRYPTION_KEY
" .env
                else
                    sed -i "/^# ENCRYPTION/a ENCRYPTION_KEY=$ENCRYPTION_KEY" .env
                fi
            else
                # 否则添加到文件末尾
                echo "" >> .env
                echo "# ENCRYPTION" >> .env
                echo "ENCRYPTION_KEY=$ENCRYPTION_KEY" >> .env
            fi
        fi
        log_success "ENCRYPTION_KEY 已自动生成"
    fi
    
    # 检查关键环境变量
    source .env
    if [ -z "$AI_API_KEY" ] || [ "$AI_API_KEY" = "your-api-key-here" ]; then
        log_error "AI_API_KEY 未配置！请编辑 .env 文件并设置您的 AI API 密钥"
        log_info "提示：编辑 .env 文件，设置 AI_API_KEY=your-actual-api-key"
        exit 1
    fi
    
    log_success "环境变量配置检查通过"
}

# 安装依赖
install_dependencies() {
    log_info "检查并安装依赖..."
    if [ ! -d "node_modules" ]; then
        log_info "node_modules 不存在，正在安装依赖..."
        pnpm install
        log_success "依赖安装完成"
    else
        log_info "node_modules 已存在，检查是否需要更新..."
        # 检查 package.json 是否比 node_modules 新
        if [ package.json -nt node_modules ]; then
            log_warning "package.json 已更新，正在重新安装依赖..."
            pnpm install
            log_success "依赖更新完成"
        else
            log_success "依赖已是最新"
        fi
    fi
}

# 创建必要的目录
create_directories() {
    log_info "创建必要的目录..."
    mkdir -p data/local/sessions
    mkdir -p prisma/data
    log_success "目录创建完成"
}

# 初始化数据库
init_database() {
    log_info "初始化数据库..."
    
    # 生成 Prisma Client
    log_info "生成 Prisma Client..."
    pnpm db:generate
    
    # 检查数据库文件是否存在
    DB_FILE=$(grep "DATABASE_URL" .env | cut -d'=' -f2 | sed 's/file://')
    if [ ! -f "$DB_FILE" ]; then
        log_info "数据库文件不存在，正在创建..."
        pnpm db:push
        log_success "数据库创建完成"
    else
        log_info "数据库文件已存在，同步 schema..."
        pnpm db:push
        log_success "数据库 schema 同步完成"
    fi
}

# 清理孤立的 JSONL 文件
cleanup_jsonl() {
    log_info "清理孤立的 session 文件..."
    if [ -f "scripts/cleanup-orphan-jsonl.ts" ]; then
        pnpm cleanup:jsonl || log_warning "清理脚本执行失败（可能是首次运行）"
    fi
}

# 构建应用（可选）
build_app() {
    if [ "$1" = "--build" ]; then
        log_info "构建应用..."
        pnpm build
        log_success "构建完成"
        return 0
    fi
    return 1
}

# 启动应用
start_app() {
    local mode=$1
    log_info "启动应用..."
    
    if [ "$mode" = "production" ]; then
        log_info "生产模式启动..."
        pnpm start
    else
        log_info "开发模式启动..."
        log_info "应用将在 http://localhost:3000 启动"
        echo ""
        
        # 等待 2 秒后自动打开浏览器
        (sleep 3 && open http://localhost:3000 2>/dev/null || xdg-open http://localhost:3000 2>/dev/null || true) &
        
        pnpm dev
    fi
}

# 主函数
main() {
    print_header
    
    # 解析参数
    BUILD_FLAG=""
    PROD_FLAG=""
    SKIP_CHECKS=""
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --build)
                BUILD_FLAG="--build"
                shift
                ;;
            --prod|--production)
                PROD_FLAG="production"
                BUILD_FLAG="--build"
                shift
                ;;
            --skip-checks)
                SKIP_CHECKS="true"
                shift
                ;;
            --help|-h)
                echo "用法: $0 [选项]"
                echo ""
                echo "选项:"
                echo "  --build          构建应用后启动"
                echo "  --prod           生产模式启动（自动构建）"
                echo "  --skip-checks    跳过环境检查（不推荐）"
                echo "  --help, -h       显示此帮助信息"
                echo ""
                echo "示例:"
                echo "  $0               # 开发模式启动"
                echo "  $0 --build       # 构建后以开发模式启动"
                echo "  $0 --prod        # 生产模式启动"
                exit 0
                ;;
            *)
                log_error "未知参数: $1"
                echo "使用 --help 查看帮助"
                exit 1
                ;;
        esac
    done
    
    # 执行检查和初始化
    if [ -z "$SKIP_CHECKS" ]; then
        check_node
        check_pnpm
        check_env
        install_dependencies
        create_directories
        init_database
        cleanup_jsonl
    fi
    
    # 构建（如果需要）
    if [ -n "$BUILD_FLAG" ]; then
        build_app --build
    fi
    
    # 启动应用
    log_success "所有检查完成，正在启动应用..."
    echo ""
    start_app "$PROD_FLAG"
}

# 捕获 Ctrl+C
trap 'echo ""; log_info "正在停止应用..."; exit 0' INT

# 运行主函数
main "$@"
