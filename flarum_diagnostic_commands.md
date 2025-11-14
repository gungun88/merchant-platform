# Flarum 扩展诊断命令

## 在服务器上运行以下命令

```bash
cd /www/wwwroot/doingfb.com

# 1. 查看 Flarum 版本和扩展列表
php flarum info

# 2. 查看扩展是否已安装
composer show doingfb/flarum-coin-exchange

# 3. 检查扩展目录
ls -la vendor/doingfb/flarum-coin-exchange/

# 4. 查看所有日志文件
find storage/logs -type f -name "*.log"

# 5. 查看扩展设置
php flarum ext:list

# 6. 检查数据库中的扩展设置
mysql -u数据库用户 -p -e "USE 数据库名; SELECT * FROM settings WHERE \`key\` LIKE '%coin_exchange%';"
```

## 或者一键执行

```bash
cd /www/wwwroot/doingfb.com && \
echo "=== Flarum 版本 ===" && \
php flarum info && \
echo "" && \
echo "=== 扩展包信息 ===" && \
composer show doingfb/flarum-coin-exchange 2>&1 && \
echo "" && \
echo "=== 扩展列表 ===" && \
php flarum ext:list && \
echo "" && \
echo "=== 扩展文件 ===" && \
ls -la vendor/doingfb/flarum-coin-exchange/ 2>&1 && \
echo "" && \
echo "=== 日志文件 ===" && \
find storage -name "*.log" -type f 2>&1
```

---

## 关于那个 500 错误

我现在明白了! 看到你的服务器路径是 `/www/wwwroot/doingfb.com`

**这就是问题所在!**

浏览器看到 composer.json 中的链接或某个地方引用了 `doingfb.com`,然后尝试访问 `https://doingfb.com/admin`,但你的服务器上 `doingfb.com` 这个域名可能:
1. 没有配置 HTTPS
2. 或者没有正确的 web 服务器配置
3. 或者这个域名根本不是你的论坛域名

## 重要问题

**你的论坛实际访问地址是什么?**

是 `https://doingfb.com` 还是其他域名?

如果不是 `doingfb.com`,那我需要帮你修改所有涉及这个域名的地方!
