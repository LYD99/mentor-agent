#!/usr/bin/env bash
# Mentor Agent 一键安装脚本
# 用法：
#   curl -fsSL https://raw.githubusercontent.com/LYD99/mentor-agent/main/install.sh | bash
#
# 环境变量（可选）：
#   REPO_URL             自定义仓库地址（默认 https://github.com/LYD99/mentor-agent.git）
#   INSTALL_DIR          安装目录（默认 mentor-agent）
#   BRANCH               分支（默认 main）
#   INSTALL_SCRIPT_URL   install.sh 的原始地址（默认按 BRANCH 推导）

set -e

REPO_URL="${REPO_URL:-https://github.com/LYD99/mentor-agent.git}"
INSTALL_DIR="${INSTALL_DIR:-mentor-agent}"
BRANCH="${BRANCH:-main}"
INSTALL_SCRIPT_URL="${INSTALL_SCRIPT_URL:-https://raw.githubusercontent.com/LYD99/mentor-agent/${BRANCH}/install.sh}"

# ──────────────────────────────────────────────────────────────────────
# 当脚本通过 `curl ... | bash` 方式被调用时，bash 自身的「脚本源」是这条
# 管道（stdin 为 pipe）。此时若在脚本内执行 `exec < /dev/tty`，bash 会改
# 从 /dev/tty 读取后续脚本内容（而非用户输入），看起来就是「卡住」。
#
# 正确做法：检测到被管道调用时，先把脚本下载到临时文件，再以 /dev/tty
# 作为 stdin 重新 exec 该文件。之后 read 自然从 tty 读取用户输入。
# ──────────────────────────────────────────────────────────────────────
if [ -z "${MENTOR_AGENT_INSTALLER_REEXEC:-}" ] && [ ! -t 0 ] && [ -r /dev/tty ]; then
    TMP_SCRIPT=$(mktemp -t mentor-agent-install.XXXXXX 2>/dev/null || mktemp)
    trap 'rm -f "$TMP_SCRIPT"' EXIT

    if command -v curl >/dev/null 2>&1; then
        curl -fsSL "$INSTALL_SCRIPT_URL" -o "$TMP_SCRIPT"
    elif command -v wget >/dev/null 2>&1; then
        wget -qO "$TMP_SCRIPT" "$INSTALL_SCRIPT_URL"
    else
        echo "需要 curl 或 wget 才能安装" >&2
        exit 1
    fi

    set +e
    MENTOR_AGENT_INSTALLER_REEXEC=1 \
    REPO_URL="$REPO_URL" INSTALL_DIR="$INSTALL_DIR" BRANCH="$BRANCH" \
        bash "$TMP_SCRIPT" "$@" </dev/tty
    ec=$?
    exit "$ec"
fi

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info()    { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[OK]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error()   { echo -e "${RED}[ERROR]${NC} $1"; }

echo ""
echo "╔════════════════════════════════════════════════╗"
echo "║          Mentor Agent 一键安装 v1.0           ║"
echo "╚════════════════════════════════════════════════╝"
echo ""

# 基础依赖检查
if ! command -v git >/dev/null 2>&1; then
    log_error "未检测到 git，请先安装 git 后重试"
    exit 1
fi

if ! command -v node >/dev/null 2>&1; then
    log_error "未检测到 Node.js，请先安装 Node.js 18+ 后重试"
    echo "  macOS:  brew install node"
    echo "  其他:   https://nodejs.org/"
    exit 1
fi

NODE_MAJOR=$(node -v | sed 's/^v//' | cut -d'.' -f1)
if [ "${NODE_MAJOR:-0}" -lt 18 ]; then
    log_error "Node.js 版本过低（当前 $(node -v)），需要 18+"
    exit 1
fi

# Clone 或更新仓库
if [ -d "$INSTALL_DIR/.git" ]; then
    log_info "检测到已有仓库：$INSTALL_DIR，拉取最新代码..."
    git -C "$INSTALL_DIR" fetch --depth 1 origin "$BRANCH"
    git -C "$INSTALL_DIR" checkout "$BRANCH" >/dev/null 2>&1 || true
    git -C "$INSTALL_DIR" reset --hard "origin/$BRANCH"
else
    log_info "克隆仓库到 ./$INSTALL_DIR ..."
    git clone --depth 1 --branch "$BRANCH" "$REPO_URL" "$INSTALL_DIR"
fi

cd "$INSTALL_DIR"
chmod +x start.sh

log_success "代码已就绪，开始启动..."
echo ""

exec ./start.sh "$@"
