#!/bin/bash

# 诊断 Flarum 时间显示问题

cd /www/wwwroot/doingfb.com

echo "========================================="
echo "诊断时间显示问题"
echo "========================================="
echo ""

echo "1. 检查服务器时间..."
date
echo ""

echo "2. 检查数据库中的实际帖子时间..."
echo "SELECT id, title, created_at, last_posted_at FROM discussions ORDER BY id DESC LIMIT 5;" | mysql -u数据库用户 -p数据库名 2>/dev/null || echo "请手动检查数据库"
echo ""

echo "3. 检查可能导致时间问题的扩展..."
php flarum extension:list | grep -E "(history|time|date|auto)"
echo ""

echo "4. 查看最近的错误日志..."
tail -n 30 storage/logs/flarum-$(date +%Y-%m-%d).log
echo ""

echo "5. 检查 mattoid/money-history-auto 扩展状态..."
ls -la vendor/mattoid/flarum-ext-money-history-auto/ 2>&1 || echo "扩展不存在"
echo ""

echo "========================================="
echo "建议操作："
echo "1. 尝试禁用可疑扩展"
echo "2. 清除缓存"
echo "3. 检查数据库实际数据"
echo "========================================="
