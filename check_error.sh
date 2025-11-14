#!/bin/bash

# 查看完整的最新错误

cd /www/wwwroot/doingfb.com

echo "========================================="
echo "查看最新的 Flarum 错误"
echo "========================================="
echo ""

echo "最后 200 行日志 (包含完整错误):"
echo "========================================="
tail -n 200 storage/logs/flarum-$(date +%Y-%m-%d).log

echo ""
echo "========================================="
echo "查找关键错误信息:"
echo "========================================="
grep -E "(Error|Exception|Fatal)" storage/logs/flarum-$(date +%Y-%m-%d).log | tail -n 20
