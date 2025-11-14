#!/bin/bash

# 修复损坏的 Composer 依赖

cd /www/wwwroot/doingfb.com

echo "========================================="
echo "修复 Flarum Composer 依赖"
echo "========================================="
echo ""

echo "1. 删除损坏的 vendor 目录..."
rm -rf vendor
echo "✓ 已删除 vendor 目录"
echo ""

echo "2. 删除 composer.lock..."
rm -f composer.lock
echo "✓ 已删除 composer.lock"
echo ""

echo "3. 重新安装所有依赖..."
composer install --no-dev
echo ""

echo "4. 清除缓存..."
rm -rf storage/cache/*
rm -rf storage/views/*
echo ""

echo "5. 修复权限..."
chown -R www:www storage vendor
chmod -R 775 storage
chmod -R 755 vendor
echo ""

echo "6. 验证 Flarum..."
php flarum info
echo ""

echo "========================================="
echo "修复完成！"
echo "========================================="
