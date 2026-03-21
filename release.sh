#!/usr/bin/env bash
set -euo pipefail

# ─── 颜色 ───
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

info()  { echo -e "${CYAN}▶ $1${NC}"; }
ok()    { echo -e "${GREEN}✔ $1${NC}"; }
warn()  { echo -e "${YELLOW}⚠ $1${NC}"; }
die()   { echo -e "${RED}✖ $1${NC}" >&2; exit 1; }

# ─── 前置检查 ───
command -v git >/dev/null 2>&1 || die "git 未安装"
command -v gh  >/dev/null 2>&1 || die "gh CLI 未安装 (brew install gh)"
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || die "当前目录不是 git 仓库"

# 确保工作区干净
if [ -n "$(git status --porcelain)" ]; then
  die "工作区有未提交的更改，请先 commit 或 stash"
fi

# ─── 读取当前版本 ───
CURRENT_VERSION=$(node -p "require('./package.json').version")
info "当前版本: v${CURRENT_VERSION}"

# ─── 选择版本升级类型 ───
echo ""
echo "请选择版本升级类型:"
echo "  1) patch  (${CURRENT_VERSION} → 修订号 +1)"
echo "  2) minor  (${CURRENT_VERSION} → 次版本 +1)"
echo "  3) major  (${CURRENT_VERSION} → 主版本 +1)"
echo "  4) 自定义版本号"
echo ""
read -rp "请输入选项 [1-4] (默认 1): " CHOICE
CHOICE=${CHOICE:-1}

IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT_VERSION"

case "$CHOICE" in
  1) PATCH=$((PATCH + 1)) ;;
  2) MINOR=$((MINOR + 1)); PATCH=0 ;;
  3) MAJOR=$((MAJOR + 1)); MINOR=0; PATCH=0 ;;
  4)
    read -rp "请输入版本号 (不带 v 前缀): " CUSTOM_VERSION
    IFS='.' read -r MAJOR MINOR PATCH <<< "$CUSTOM_VERSION"
    ;;
  *) die "无效选项: $CHOICE" ;;
esac

NEW_VERSION="${MAJOR}.${MINOR}.${PATCH}"
TAG="v${NEW_VERSION}"

# 检查 tag 是否已存在
if git rev-parse "$TAG" >/dev/null 2>&1; then
  die "Tag $TAG 已存在"
fi

ok "新版本: ${TAG}"

# ─── 生成 changelog ───
LAST_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "")
if [ -n "$LAST_TAG" ]; then
  CHANGELOG=$(git log "${LAST_TAG}..HEAD" --pretty=format:"- %s (%h)" --no-merges)
else
  CHANGELOG=$(git log --pretty=format:"- %s (%h)" --no-merges)
fi

if [ -z "$CHANGELOG" ]; then
  CHANGELOG="- 常规更新"
fi

echo ""
info "变更日志:"
echo "$CHANGELOG"
echo ""

# ─── 确认发布 ───
read -rp "确认发布 ${TAG}? [y/N]: " CONFIRM
if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
  warn "已取消发布"
  exit 0
fi

# ─── 更新 package.json 版本号 ───
info "更新 package.json 版本号..."
node -e "
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
pkg.version = '${NEW_VERSION}';
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
"
ok "package.json 已更新为 ${NEW_VERSION}"

# ─── 构建 ───
if grep -q '"build"' package.json; then
  info "执行构建..."
  npm run build
  ok "构建完成"
fi

# ─── 提交 + Tag ───
git add package.json
git commit -m "release: ${TAG}"
ok "已提交版本更新"

git tag -a "$TAG" -m "Release ${TAG}

${CHANGELOG}"
ok "已创建 tag: ${TAG}"

# ─── 推送 ───
info "推送到远程仓库..."
git push origin main
git push origin "$TAG"
ok "已推送 tag 到远程"

# ─── 创建 GitHub Release ───
info "创建 GitHub Release..."
gh release create "$TAG" \
  --title "Release ${TAG}" \
  --notes "${CHANGELOG}" \
  --latest
ok "GitHub Release 已创建: ${TAG}"

echo ""
echo -e "${GREEN}🎉 发布完成! ${TAG}${NC}"
echo -e "   Release 页面: $(gh release view "$TAG" --json url -q '.url')"
