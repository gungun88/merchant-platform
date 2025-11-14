#!/bin/bash

# 更新 Flarum 扩展并清除缓存

cd /www/wwwroot/doingfb.com

echo "========================================="
echo "更新 Flarum 硬币兑换扩展"
echo "========================================="
echo ""

echo "1. 更新扩展..."
composer update doingfb/flarum-coin-exchange --with-all-dependencies
echo ""

echo "2. 清除所有缓存..."
php flarum cache:clear
rm -rf storage/cache/*
rm -rf storage/views/*
echo ""

echo "3. 修复权限（如果需要）..."
chown -R www:www storage vendor/doingfb
chmod -R 775 storage
chmod -R 755 vendor/doingfb
echo ""

echo "4. 验证扩展版本..."
composer show doingfb/flarum-coin-exchange
echo ""

echo "========================================="
echo "更新完成！"
echo "========================================="
echo ""
echo "请刷新浏览器重试！"
