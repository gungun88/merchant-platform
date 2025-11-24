# 宝塔面板部署指南

本文档详细说明如何在宝塔面板上部署 Next.js 商家展示平台。

## 目录
- [环境要求](#环境要求)
- [部署前准备](#部署前准备)
- [宝塔面板配置](#宝塔面板配置)
- [应用部署步骤](#应用部署步骤)
- [域名配置](#域名配置)
- [SSL 证书配置](#ssl-证书配置)
- [Supabase 配置](#supabase-配置)
- [PM2 进程管理](#pm2-进程管理)
- [故障排查](#故障排查)

---

## 环境要求

### 服务器配置
- **操作系统**: Linux (推荐 CentOS 7+ / Ubuntu 18.04+)
- **内存**: 至少 2GB RAM (推荐 4GB+)
- **CPU**: 2核心以上
- **磁盘**: 至少 20GB 可用空间
- **宝塔面板**: 7.x 或更高版本

### 软件要求
- **Node.js**: 18.17.0 或更高版本 (推荐 20.x LTS)
- **npm**: 9.0+ 或 pnpm 8.0+
- **PM2**: 用于进程管理
- **Nginx**: 反向代理 (宝塔自带)

---

## 部署前准备

### 1. 在宝塔面板安装必要软件

登录宝塔面板后，安装以下软件：

1. **安装 Node.js**
   - 进入 "软件商店" → 搜索 "Node.js版本管理器"
   - 安装后，选择安装 Node.js 20.x LTS 版本

2. **安装 PM2**
   ```bash
   npm install -g pm2
   ```

3. **安装 Nginx** (如果尚未安装)
   - 软件商店 → 搜索 "Nginx" → 安装

### 2. 创建网站目录

在宝塔面板中：
1. 点击 "网站" → "添加站点"
2. 域名填写: ` `
3. 根目录: `/www/wwwroot/merchant.doingfb.com`
4. PHP 版本: 选择 "纯静态"
5. 数据库: 不创建 (使用 Supabase)
6. 创建 FTP: 可选

---

## 宝塔面板配置

### 1. 上传项目文件

**方式一：使用 Git (推荐)**

SSH 登录服务器后执行：

```bash
# 进入网站目录
cd /www/wwwroot/merchant.doingfb.com

# 克隆项目
git clone https://github.com/gungun88/merchant-platform.git .

# 如果目录不为空，先清空
rm -rf *
git clone https://github.com/gungun88/merchant-platform.git .
```

**方式二：使用宝塔文件管理器**

1. 在本地打包项目（排除 node_modules 和 .next）
2. 通过宝塔面板上传到 `/www/wwwroot/merchant.doingfb.com`
3. 解压文件

### 2. 配置环境变量

SSH 登录服务器后：

```bash
cd /www/wwwroot/merchant.doingfb.com

# 复制生产环境配置
cp .env.production .env.local

# 或者直接创建 .env.local
nano .env.local
```

将以下内容粘贴到 `.env.local`:

```env
# 生产环境配置
NEXT_PUBLIC_SUPABASE_URL=https://vqdkrubllqjgxohxdpei.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZxZGtydWJsbHFqZ3hvaHhkcGVpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjExMTY1MzQsImV4cCI6MjA3NjY5MjUzNH0.Y3IORcCRE-SGCwgB_pMxQPkbZSvMFUQax8n1hhecZ4A
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZxZGtydWJsbHFqZ3hvaHhkcGVpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTExNjUzNCwiZXhwIjoyMDc2NjkyNTM0fQ.08SezL9H1QGZLGS-UrcVMXAOMXggXI1-nTRbAhgHBsc
NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL=https://merchant.doingfb.com
COIN_EXCHANGE_API_SECRET=E483D0FCDCA7D2A900F679BFBE149BB34FE518A149BB8B7529EB0FCA6773BF45
CRON_SECRET=0d9e9ce69b070295c697db3eb4935673
NODE_ENV=production
```

保存并退出 (Ctrl+X → Y → Enter)

---

## 应用部署步骤

### 1. 安装依赖

```bash
cd /www/wwwroot/merchant.doingfb.com

# 使用 npm 安装（需要 --legacy-peer-deps 处理 React 19 兼容性）
npm install --legacy-peer-deps

# 或使用 pnpm (更快，自动处理对等依赖)
npm install -g pnpm
pnpm install
```

### 2. 构建项目

```bash
# 清理之前的构建
rm -rf .next

# 构建生产版本
npm run build

# 构建完成后，检查 .next 目录是否存在
ls -la .next
```

### 3. 使用 PM2 启动应用

使用项目中的 PM2 配置文件：

```bash
# 启动应用
pm2 start ecosystem.config.js

# 查看应用状态
pm2 status

# 查看日志
pm2 logs merchant-platform

# 设置开机自启
pm2 startup
pm2 save
```

### 4. 验证应用运行

```bash
# 检查应用是否在 3000 端口运行
curl http://localhost:3000

# 或者查看 PM2 日志
pm2 logs merchant-platform --lines 50
```

---

## 域名配置

### 1. 配置 Nginx 反向代理

在宝塔面板中：

1. 进入 "网站" → 找到你的站点 → 点击 "设置"
2. 选择 "反向代理" → "添加反向代理"
3. 配置如下：

```
代理名称: Next.js App
目标URL: http://127.0.0.1:3000
发送域名: $host
```

4. 或者直接编辑 Nginx 配置文件：

点击 "配置文件"，在 `server` 块中添加：

```nginx
location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_cache_bypass $http_upgrade;

    # 超时设置
    proxy_connect_timeout 60s;
    proxy_send_timeout 60s;
    proxy_read_timeout 60s;
}

# Next.js 静态资源
location /_next/static {
    alias /www/wwwroot/merchant.doingfb.com/.next/static;
    expires 365d;
    access_log off;
}

# 上传的图片和静态资源
location /uploads {
    alias /www/wwwroot/merchant.doingfb.com/public/uploads;
    expires 30d;
    access_log off;
}
```

5. 保存配置后，重启 Nginx

### 2. 设置文件上传大小限制

在 Nginx 配置的 `server` 块中添加：

```nginx
client_max_body_size 10M;
```

---

## SSL 证书配置

### 1. 申请 SSL 证书

在宝塔面板中：

1. 进入网站设置 → "SSL" 标签
2. 选择 "Let's Encrypt" 免费证书
3. 输入邮箱地址
4. 勾选域名：`merchant.doingfb.com`
5. 点击 "申请"

### 2. 强制 HTTPS

证书申请成功后：
- 勾选 "强制HTTPS"
- 这会自动将 HTTP 请求重定向到 HTTPS

### 3. 验证 SSL

访问 https://merchant.doingfb.com 确认证书生效

---

## Supabase 配置

### 1. 添加生产环境 URL 到允许列表

登录 Supabase Dashboard：

1. 进入项目设置 → Authentication → URL Configuration
2. 在 "Site URL" 中设置: `https://merchant.doingfb.com`
3. 在 "Redirect URLs" 中添加:
   - `https://merchant.doingfb.com`
   - `https://merchant.doingfb.com/auth/callback`
   - `https://merchant.doingfb.com/**`

### 2. 配置 CORS

在 Supabase Dashboard:

1. 进入 Settings → API
2. 在 "API Settings" 中确认 CORS 配置包含你的域名

### 3. 更新环境变量

确保生产环境的 `.env.local` 中的 Supabase URL 正确。

---

## PM2 进程管理

### 常用命令

```bash
# 查看所有进程
pm2 list

# 查看应用状态
pm2 status merchant-platform

# 重启应用
pm2 restart merchant-platform

# 停止应用
pm2 stop merchant-platform

# 删除应用
pm2 delete merchant-platform

# 查看日志
pm2 logs merchant-platform

# 查看实时日志
pm2 logs merchant-platform --lines 100

# 查看错误日志
pm2 logs merchant-platform --err

# 清空日志
pm2 flush

# 监控
pm2 monit
```

### 应用更新流程

当需要更新应用时：

```bash
# 1. 进入项目目录
cd /www/wwwroot/merchant.doingfb.com

# 2. 拉取最新代码
git pull origin main

# 3. 安装新依赖（如果有）
npm install

# 4. 重新构建
npm run build

# 5. 重启应用
pm2 restart merchant-platform

# 6. 查看日志确认
pm2 logs merchant-platform --lines 50
```

或者使用部署脚本：

```bash
bash deploy.sh
```

---

## 故障排查

### 1. 应用无法启动

**检查端口占用：**
```bash
netstat -tlnp | grep 3000
```

**查看 PM2 日志：**
```bash
pm2 logs merchant-platform --err --lines 100
```

**常见问题：**
- 端口被占用：修改 `ecosystem.config.js` 中的端口
- 依赖缺失：重新运行 `npm install`
- 环境变量错误：检查 `.env.local` 文件

### 2. 502 Bad Gateway

**原因：**
- Next.js 应用未运行
- Nginx 配置错误

**解决：**
```bash
# 检查应用状态
pm2 status

# 如果应用停止，重启
pm2 restart merchant-platform

# 检查 Nginx 配置
nginx -t

# 重启 Nginx
systemctl restart nginx
```

### 3. 静态资源 404

**检查路径配置：**
- 确认 Nginx 配置中的 `alias` 路径正确
- 确认 `.next/static` 目录存在

### 4. 数据库连接失败

**检查：**
- Supabase URL 是否正确
- 服务器能否访问 Supabase (防火墙/网络)
- API Key 是否有效

```bash
# 测试连接
curl https://vqdkrubllqjgxohxdpei.supabase.co
```

### 5. 内存不足

**查看内存使用：**
```bash
free -h
pm2 monit
```

**优化：**
- 增加服务器内存
- 调整 PM2 配置中的 `max_memory_restart`
- 减少并发实例数

### 6. 构建失败

**常见原因：**
- TypeScript 类型错误
- 依赖版本冲突
- 磁盘空间不足

**解决：**
```bash
# 清理缓存
rm -rf .next node_modules
npm cache clean --force

# 重新安装依赖
npm install

# 重新构建
npm run build
```

### 7. 查看系统日志

```bash
# PM2 日志
pm2 logs merchant-platform --lines 200

# Nginx 访问日志
tail -f /www/wwwroot/merchant.doingfb.com/log/access.log

# Nginx 错误日志
tail -f /www/wwwroot/merchant.doingfb.com/log/error.log

# 系统日志
journalctl -u nginx -f
```

---

## 性能优化建议

### 1. 启用 Nginx 缓存

在 Nginx 配置中添加：

```nginx
# 在 http 块中
proxy_cache_path /var/cache/nginx levels=1:2 keys_zone=my_cache:10m max_size=1g inactive=60m;

# 在 location 块中
proxy_cache my_cache;
proxy_cache_valid 200 60m;
proxy_cache_valid 404 1m;
```

### 2. 启用 Gzip 压缩

在宝塔面板中：
- 网站设置 → 配置文件 → 确认 gzip 已启用

### 3. CDN 配置

如果使用 CDN (如 Cloudflare):
- 将静态资源路径添加到 CDN 缓存规则
- 配置 Cache-Control headers

### 4. PM2 集群模式

对于高流量场景，可以使用集群模式：

修改 `ecosystem.config.js`:
```javascript
instances: 2, // 或 'max' 使用所有 CPU 核心
exec_mode: 'cluster'
```

---

## 监控和维护

### 1. 设置监控

**使用 PM2 Plus (可选):**
```bash
pm2 link <secret> <public>
```

**或使用宝塔监控:**
- 面板 → 监控 → 添加监控任务

### 2. 定期备份

**备份内容：**
- 应用代码 (已在 Git 中)
- 环境变量文件 `.env.local`
- 上传的文件 (如有)
- PM2 配置

**宝塔定时任务：**
```bash
# 每天凌晨 2 点备份
0 2 * * * tar -czf /backup/merchant-$(date +\%Y\%m\%d).tar.gz /www/wwwroot/merchant.doingfb.com --exclude=node_modules --exclude=.next
```

### 3. 日志轮转

PM2 会自动管理日志，也可以使用 `pm2 install pm2-logrotate`:

```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
```

---

## 安全建议

1. **定期更新依赖:**
   ```bash
   npm audit
   npm update
   ```

2. **限制 SSH 访问:**
   - 使用密钥认证
   - 禁用 root 登录
   - 修改默认 SSH 端口

3. **配置防火墙:**
   - 只开放必要端口: 80, 443, SSH
   - 使用宝塔的安全功能

4. **保护敏感信息:**
   - 不要将 `.env.local` 提交到 Git
   - 定期轮换 API 密钥

---

## 联系支持

如有问题，请：
1. 查看本文档的故障排查部分
2. 检查项目 GitHub Issues
3. 联系开发团队

---

**部署完成！** 🎉

访问 https://merchant.doingfb.com 查看你的应用。
