#!/bin/bash

# Flarum 扩展权限修复脚本
# 修复 500 错误 - 文件权限问题

echo "========================================="
echo "开始修复 Flarum 文件权限问题"
echo "========================================="
echo ""

cd /www/wwwroot/doingfb.com

echo "1. 修复 storage 目录权限..."
chown -R www:www storage
chmod -R 775 storage
echo "✓ storage 目录权限已修复"

echo ""
echo "2. 修复扩展目录权限..."
chown -R www:www vendor/doingfb
chmod -R 755 vendor/doingfb
echo "✓ 扩展目录权限已修复"

echo ""
echo "3. 清除 Flarum 缓存..."
php flarum cache:clear
echo "✓ 缓存已清除"

echo ""
echo "4. 验证权限设置..."
ls -la storage/ | head -n 10
echo ""
ls -la vendor/doingfb/ | head -n 5

echo ""
echo "========================================="
echo "权限修复完成！"
echo "========================================="
echo ""
echo "请执行以下步骤："
echo "1. 刷新浏览器"
echo "2. 重新访问扩展设置页面"
echo "3. 如果还有问题，运行以下命令查看新日志："
echo "   tail -n 50 storage/logs/flarum-\$(date +%Y-%m-%d).log"
echo ""
