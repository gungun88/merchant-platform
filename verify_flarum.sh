#!/bin/bash

# 验证 Flarum 状态和数据库连接

cd /www/wwwroot/doingfb.com

echo "========================================="
echo "检查 Flarum 状态"
echo "========================================="
echo ""

echo "1. 验证 Flarum 版本和扩展..."
php flarum info
echo ""

echo "2. 检查数据库连接..."
php flarum info | grep -i database || echo "检查 config.php 中的数据库配置"
echo ""

echo "3. 列出所有已启用的扩展..."
php flarum extension:list
echo ""

echo "4. 检查是否有硬币兑换扩展残留..."
php flarum extension:list | grep -i coin || echo "✓ 硬币兑换扩展已完全卸载"
echo ""

echo "5. 清除所有缓存..."
php flarum cache:clear
rm -rf storage/cache/*
rm -rf storage/views/*
echo "✓ 缓存已清除"
echo ""

echo "========================================="
echo "检查完成！"
echo "========================================="
