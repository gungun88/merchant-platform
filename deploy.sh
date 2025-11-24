#!/bin/bash

# ============================================
# 商家展示平台 - 自动化部署脚本
# ============================================
# 用途：快速更新和重启生产环境应用
# 使用方法：bash deploy.sh
# ============================================

set -e  # 遇到错误立即退出

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 项目信息
APP_NAME="merchant-platform"
APP_DIR="/www/wwwroot/merchant.doingfb.com"
BRANCH="main"

# 打印带颜色的消息
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 打印分隔线
print_separator() {
    echo "============================================"
}

# 检查命令是否存在
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# 开始部署
print_separator
print_info "开始部署 ${APP_NAME}..."
print_separator
echo ""

# 1. 检查必要的工具
print_info "检查必要工具..."

if ! command_exists git; then
    print_error "Git 未安装，请先安装 Git"
    exit 1
fi

if ! command_exists node; then
    print_error "Node.js 未安装，请先安装 Node.js"
    exit 1
fi

if ! command_exists pm2; then
    print_error "PM2 未安装，正在安装..."
    npm install -g pm2
fi

print_success "工具检查完成"
echo ""

# 2. 进入项目目录
print_info "进入项目目录: ${APP_DIR}"
cd "${APP_DIR}" || {
    print_error "无法进入目录 ${APP_DIR}"
    exit 1
}
print_success "已进入项目目录"
echo ""

# 3. 拉取最新代码
print_info "拉取最新代码..."
git fetch origin

# 检查是否有本地未提交的更改
if [[ -n $(git status -s) ]]; then
    print_warning "检测到本地未提交的更改"
    print_info "暂存本地更改..."
    git stash
    STASHED=true
else
    STASHED=false
fi

# 拉取代码
print_info "更新代码到最新版本..."
git pull origin "${BRANCH}"

# 如果之前暂存了更改，尝试恢复
if [ "$STASHED" = true ]; then
    print_info "尝试恢复本地更改..."
    if git stash pop; then
        print_success "本地更改已恢复"
    else
        print_warning "恢复本地更改时发生冲突，请手动处理"
    fi
fi

print_success "代码更新完成"
echo ""

# 4. 安装依赖
print_info "检查并安装新依赖..."
if [ -f "package-lock.json" ]; then
    npm ci --production=false
else
    npm install --production=false
fi
print_success "依赖安装完成"
echo ""

# 5. 构建项目
print_info "构建生产版本..."

# 清理旧的构建
if [ -d ".next" ]; then
    print_info "清理旧的构建文件..."
    rm -rf .next
fi

# 构建
npm run build

if [ $? -eq 0 ]; then
    print_success "构建成功"
else
    print_error "构建失败，请检查错误信息"
    exit 1
fi
echo ""

# 6. 创建日志目录
if [ ! -d "logs" ]; then
    print_info "创建日志目录..."
    mkdir -p logs
fi

# 7. 重启应用
print_info "重启应用..."

# 检查应用是否在运行
if pm2 list | grep -q "${APP_NAME}"; then
    print_info "应用正在运行，执行重启..."
    pm2 restart "${APP_NAME}"
else
    print_info "应用未运行，启动应用..."
    pm2 start ecosystem.config.js
fi

# 保存 PM2 进程列表
pm2 save

print_success "应用重启完成"
echo ""

# 8. 验证部署
print_info "验证部署状态..."
sleep 3

# 检查 PM2 状态
pm2 status "${APP_NAME}"

# 检查应用是否正常响应
print_info "检查应用响应..."
HTTP_CODE=$(curl -o /dev/null -s -w "%{http_code}" http://localhost:3000)

if [ "$HTTP_CODE" = "200" ]; then
    print_success "应用响应正常 (HTTP ${HTTP_CODE})"
else
    print_warning "应用响应异常 (HTTP ${HTTP_CODE})"
    print_info "查看最近的日志:"
    pm2 logs "${APP_NAME}" --lines 20 --nostream
fi

echo ""

# 9. 完成
print_separator
print_success "部署完成！ 🎉"
print_separator
echo ""

print_info "应用信息:"
echo "  - 应用名称: ${APP_NAME}"
echo "  - 运行端口: 3000"
echo "  - 访问地址: https://merchant.doingfb.com"
echo ""

print_info "常用命令:"
echo "  - 查看日志: pm2 logs ${APP_NAME}"
echo "  - 重启应用: pm2 restart ${APP_NAME}"
echo "  - 查看状态: pm2 status"
echo "  - 停止应用: pm2 stop ${APP_NAME}"
echo ""

print_info "如果遇到问题，请查看日志:"
echo "  pm2 logs ${APP_NAME} --lines 100"
echo ""

exit 0
