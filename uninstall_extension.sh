#!/bin/bash

# 卸载 Flarum 硬币兑换扩展

cd /www/wwwroot/doingfb.com

echo "========================================="
echo "卸载 Flarum 硬币兑换扩展"
echo "========================================="
echo ""

echo "1. 在 Flarum 中禁用扩展..."
php flarum extension:disable doingfb-coin-exchange
echo ""

echo "2. 使用 Composer 卸载扩展..."
composer remove doingfb/flarum-coin-exchange
echo ""

echo "3. 清除所有缓存..."
php flarum cache:clear
rm -rf storage/cache/*
rm -rf storage/views/*
echo ""

echo "4. 验证扩展已卸载..."
php flarum extension:list | grep -i coin || echo "✓ 扩展已完全卸载"
echo ""

echo "========================================="
echo "卸载完成！"
echo "========================================="
