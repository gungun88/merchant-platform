#!/bin/bash

# 修复 Git 所有权并卸载扩展

cd /www/wwwroot/doingfb.com

echo "========================================="
echo "修复 Git 所有权问题"
echo "========================================="
echo ""

echo "1. 修复 Git 所有权警告..."
git config --global --add safe.directory /www/wwwroot/doingfb.com
git config --global --add safe.directory '*'
echo "✓ Git 所有权已修复"
echo ""

echo "2. 手动删除扩展目录..."
rm -rf vendor/doingfb/flarum-coin-exchange
echo "✓ 扩展目录已删除"
echo ""

echo "3. 从 composer.json 中移除扩展仓库..."
# 注意：需要手动编辑 composer.json 删除 repositories 中的 VCS 配置
echo "请手动编辑 composer.json，删除以下内容："
echo "  {"
echo "    \"type\": \"vcs\","
echo "    \"url\": \"https://github.com/gungun88/flarum-coin-exchange.git\""
echo "  }"
echo ""

echo "4. 运行 Composer 更新..."
composer update --no-dev
echo ""

echo "5. 清除 Flarum 缓存..."
php flarum cache:clear
rm -rf storage/cache/*
rm -rf storage/views/*
echo ""

echo "6. 修复文件权限..."
chown -R www:www storage vendor
chmod -R 775 storage
echo ""

echo "========================================="
echo "清理完成！"
echo "========================================="
