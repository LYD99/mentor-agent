#!/bin/bash

# Mentor Agent 一键启动脚本
# 用途：检查环境、初始化数据库、启动应用

set -e  # 遇到错误立即退出

# 说明：start.sh 始终作为文件被调用（`./start.sh` 或由 install.sh 重新
# exec 后调用），stdin 天然是 tty，因此不需要也不应该在此处执行
# `exec < /dev/tty` —— 那会在脚本源自 pipe 的场景下让 bash 从 tty 读取
# 后续脚本内容导致挂起。

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

# 跨平台打开 URL
open_url() {
    local url=$1
    if command -v open >/dev/null 2>&1; then
        open "$url" >/dev/null 2>&1 &
    elif command -v xdg-open >/dev/null 2>&1; then
        xdg-open "$url" >/dev/null 2>&1 &
    elif command -v powershell.exe >/dev/null 2>&1; then
        powershell.exe -NoProfile -Command "Start-Process '$url'" >/dev/null 2>&1 &
    else
        log_warning "无法自动打开浏览器，请手动访问：$url"
    fi
}

# 在 .env 中写入/更新某个 key 的值（支持 KEY=、# KEY= 两种形式）
set_env_var() {
    local key=$1
    local value=$2
    # 为 sed 转义分隔符与反斜杠
    local escaped
    escaped=$(printf '%s' "$value" | sed -e 's/[\\|&]/\\&/g')

    if grep -q "^${key}=" .env; then
        if [[ "$OSTYPE" == "darwin"* ]]; then
            sed -i '' "s|^${key}=.*|${key}=${escaped}|" .env
        else
            sed -i "s|^${key}=.*|${key}=${escaped}|" .env
        fi
    elif grep -q "^# *${key}=" .env; then
        if [[ "$OSTYPE" == "darwin"* ]]; then
            sed -i '' "s|^# *${key}=.*|${key}=${escaped}|" .env
        else
            sed -i "s|^# *${key}=.*|${key}=${escaped}|" .env
        fi
    else
        echo "${key}=${value}" >> .env
    fi
}

# 读取 .env 中某个 key 的值（不含引号）
get_env_var() {
    local key=$1
    [ -f .env ] || return 0
    grep "^${key}=" .env | head -n1 | cut -d'=' -f2- | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//"
}

# 校验 AI API Key 是否可用
# 返回：0=有效，1=认证失败，2=无法判断（网络错误等）
validate_ai_key() {
    local key=$1
    local base_url=${2:-https://api.deepseek.com}
    local model=${3:-deepseek-chat}

    # 去除末尾的 / 与 /v1，避免拼接重复
    base_url="${base_url%/}"
    base_url="${base_url%/v1}"

    if ! command -v curl >/dev/null 2>&1; then
        return 2
    fi

    local http_code
    http_code=$(curl -sS -o /dev/null -w "%{http_code}" \
        -X POST "${base_url}/v1/chat/completions" \
        -H "Authorization: Bearer ${key}" \
        -H "Content-Type: application/json" \
        -d "{\"model\":\"${model}\",\"messages\":[{\"role\":\"user\",\"content\":\"hi\"}],\"max_tokens\":1}" \
        --max-time 15 2>/dev/null || echo "000")

    case "$http_code" in
        200) return 0 ;;
        401|403) return 1 ;;
        *) return 2 ;;
    esac
}

# 交互式引导用户配置 AI_API_KEY（无效/为空时打开 DeepSeek 平台）
prompt_ai_key() {
    local current_key current_base current_model
    current_key=$(get_env_var AI_API_KEY)
    current_base=$(get_env_var AI_BASE_URL)
    current_model=$(get_env_var AI_MODEL)

    local needs_key=false
    if [ -z "$current_key" ] || [ "$current_key" = "your-api-key-here" ]; then
        needs_key=true
    else
        log_info "校验 AI_API_KEY 有效性..."
        validate_ai_key "$current_key" "$current_base" "$current_model"
        case $? in
            0)
                log_success "AI_API_KEY 校验通过"
                return 0
                ;;
            1)
                log_warning "AI_API_KEY 认证失败，需要重新配置"
                needs_key=true
                ;;
            2)
                log_warning "无法连通 AI 服务进行校验（网络问题或自定义服务），跳过校验"
                return 0
                ;;
        esac
    fi

    if $needs_key; then
        echo ""
        log_warning "AI_API_KEY 未配置或无效，将自动打开 DeepSeek 控制台"
        log_info "页面：https://platform.deepseek.com/api_keys"
        open_url "https://platform.deepseek.com/api_keys"
        echo ""
        echo "请在浏览器中 登录/注册 并 创建 API Key，然后粘贴到此处。"
        echo "（若使用其他 OpenAI 兼容服务，也可直接粘贴对应 Key）"
        echo ""

        local attempt=0
        while true; do
            attempt=$((attempt + 1))
            printf "请输入 AI_API_KEY: "
            local input_key=""
            IFS= read -r input_key || true
            input_key="${input_key#"${input_key%%[![:space:]]*}"}" # 去前空格
            input_key="${input_key%"${input_key##*[![:space:]]}"}" # 去后空格

            if [ -z "$input_key" ]; then
                log_error "API Key 不能为空"
                [ "$attempt" -ge 5 ] && { log_error "多次输入失败，退出"; exit 1; }
                continue
            fi

            # 若用户之前未配置过 base_url 或仍是默认 openai，则默认设置为 DeepSeek
            local use_base="$current_base"
            local use_model="$current_model"
            if [ -z "$use_base" ] || [ "$use_base" = "https://api.openai.com" ]; then
                use_base="https://api.deepseek.com"
            fi
            if [ -z "$use_model" ]; then
                use_model="deepseek-chat"
            fi

            log_info "校验 API Key..."
            validate_ai_key "$input_key" "$use_base" "$use_model"
            local rc=$?
            if [ $rc -eq 0 ]; then
                set_env_var AI_API_KEY "$input_key"
                set_env_var AI_BASE_URL "$use_base"
                set_env_var AI_MODEL "$use_model"
                log_success "AI_API_KEY 校验通过，已写入 .env"
                return 0
            elif [ $rc -eq 1 ]; then
                log_error "API Key 认证失败，请重试（或按 Ctrl+C 退出）"
                [ "$attempt" -ge 5 ] && { log_error "多次校验失败，退出"; exit 1; }
            else
                log_warning "无法连接 AI 服务进行校验，暂按你输入保存"
                set_env_var AI_API_KEY "$input_key"
                set_env_var AI_BASE_URL "$use_base"
                set_env_var AI_MODEL "$use_model"
                return 0
            fi
        done
    fi
}

# 交互式引导用户配置 TAVILY_API_KEY（可选）
prompt_tavily_key() {
    local current_key
    current_key=$(get_env_var TAVILY_API_KEY)

    if [ -n "$current_key" ] && [ "$current_key" != "your-tavily-key" ]; then
        log_success "TAVILY_API_KEY 已配置"
        return 0
    fi

    echo ""
    log_info "TAVILY_API_KEY 未配置（用于联网搜索功能，可选）"
    log_info "页面：https://app.tavily.com/home"
    open_url "https://app.tavily.com/home"
    echo ""
    printf "请输入 TAVILY_API_KEY（可选，直接回车跳过）: "
    local tavily_key=""
    IFS= read -r tavily_key || true
    tavily_key="${tavily_key#"${tavily_key%%[![:space:]]*}"}"
    tavily_key="${tavily_key%"${tavily_key##*[![:space:]]}"}"

    if [ -n "$tavily_key" ]; then
        set_env_var TAVILY_API_KEY "$tavily_key"
        log_success "TAVILY_API_KEY 已保存"
    else
        log_info "已跳过 Tavily 配置（联网搜索功能将不可用）"
    fi
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
    
    # 交互式引导用户配置必要/可选的 API Key
    prompt_ai_key
    prompt_tavily_key

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
