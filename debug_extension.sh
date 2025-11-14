#!/bin/bash

# Flarum 扩展调试脚本
# 在服务器上运行: bash debug_extension.sh

cd /www/wwwroot/doingfb.com

echo "========================================="
echo "Flarum 硬币兑换扩展调试"
echo "========================================="
echo ""

echo "1. 检查 PHP 错误日志..."
if [ -f "storage/logs/flarum-$(date +%Y-%m-%d).log" ]; then
    echo "今天的日志:"
    tail -n 20 "storage/logs/flarum-$(date +%Y-%m-%d).log"
else
    echo "未找到今天的日志文件"
    echo "检查所有日志:"
    find storage/logs -name "*.log" -type f -exec echo "文件: {}" \; -exec tail -n 5 {} \;
fi

echo ""
echo "2. 检查 Web 服务器错误日志..."
if [ -f "/www/wwwlogs/doingfb.com.error.log" ]; then
    echo "Nginx 错误日志最后 10 行:"
    tail -n 10 /www/wwwlogs/doingfb.com.error.log
fi

echo ""
echo "3. 检查 PHP 语法..."
find vendor/doingfb/flarum-coin-exchange/src -name "*.php" -exec php -l {} \; | grep -v "No syntax errors"

echo ""
echo "4. 检查扩展文件完整性..."
echo "核心文件检查:"
for file in extend.php composer.json js/dist/admin.js js/dist/forum.js src/Controller/ExchangeController.php; do
    if [ -f "vendor/doingfb/flarum-coin-exchange/$file" ]; then
        echo "✓ $file 存在"
    else
        echo "✗ $file 缺失"
    fi
done

echo ""
echo "5. 检查扩展是否已启用..."
php flarum extension:list | grep -i coin

echo ""
echo "6. 测试 PHP 加载扩展..."
php -r "
require 'vendor/autoload.php';
try {
    \$class = new \DoingFB\CoinExchange\Controller\ExchangeController(new \Flarum\Settings\DatabaseSettingsRepository(new \Illuminate\Database\Capsule\Manager));
    echo '✓ ExchangeController 类加载成功\n';
} catch (Exception \$e) {
    echo '✗ 加载失败: ' . \$e->getMessage() . '\n';
}
"

echo ""
echo "7. 检查数据库设置..."
echo "SELECT * FROM settings WHERE \`key\` LIKE '%coin_exchange%';" | mysql -uroot -p论坛数据库名 2>/dev/null || echo "请手动检查数据库"

echo ""
echo "========================================="
echo "调试完成！"
echo "========================================="
