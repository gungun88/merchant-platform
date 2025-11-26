# 生产环境部署指南

## 📋 部署前检查清单

### 1. 本地测试确认
- ✅ 开发服务器运行正常
- ✅ 数据库字段完整
- ✅ 所有功能测试通过

### 2. 代码变更
```bash
# 查看有哪些文件被修改
git status

# 查看具体修改内容
git diff
```

---

## 🚀 部署步骤

### 第一步: 提交代码到 GitHub

```bash
# 1. 添加所有新文件和修改
git add .

# 2. 提交变更
git commit -m "chore: 添加数据库诊断和修复工具

- 添加数据库诊断脚本 (999_diagnose_database.sql)
- 添加数据库修复脚本 (999_comprehensive_fix.sql)
- 添加数据库连接测试工具 (test_database_connection.js)
- 添加诊断报告文档 (DIAGNOSIS_REPORT.md)
- 更新其他诊断相关脚本
"

# 3. 推送到 GitHub
git push origin main
```

---

### 第二步: 在 VPS 上更新代码

```bash
# SSH 连接到你的 VPS
ssh your-username@your-vps-ip

# 进入项目目录
cd /path/to/your/project

# 拉取最新代码
git pull origin main

# 安装依赖(如果有新的依赖)
npm install

# 清理旧的构建缓存
rm -rf .next

# 重新构建生产版本
npm run build
```

---

### 第三步: 重启 PM2

```bash
# 方法1: 重启应用
pm2 restart your-app-name

# 方法2: 如果上面不行,先停止再启动
pm2 stop your-app-name
pm2 start your-app-name

# 查看日志,确认启动成功
pm2 logs your-app-name --lines 50

# 查看状态
pm2 status
```

---

## ⚠️ 重要提示

### 关于数据库脚本
**不需要执行 SQL 脚本!**

原因:
1. ✅ 你的本地和生产环境使用**同一个 Supabase 数据库**
2. ✅ 本地测试显示数据库结构**完全正常**
3. ✅ 所有字段和表都**已经存在**

### 如果生产环境仍有问题
可能的原因:
1. **构建缓存问题** - .next 文件夹没有清理
2. **环境变量不一致** - VPS 上的 .env 配置有问题
3. **Node.js 版本不同** - 开发和生产环境版本不一致
4. **依赖版本问题** - package-lock.json 需要更新

---

## 🔍 生产环境故障排查

### 1. 检查 PM2 日志
```bash
# 查看实时日志
pm2 logs your-app-name

# 查看错误日志
pm2 logs your-app-name --err

# 查看最近 100 行日志
pm2 logs your-app-name --lines 100
```

### 2. 检查环境变量
```bash
# 查看 VPS 上的 .env 文件
cat .env

# 或者 .env.local
cat .env.local

# 确保包含:
# NEXT_PUBLIC_SUPABASE_URL=your-url
# NEXT_PUBLIC_SUPABASE_ANON_KEY=your-key
# SUPABASE_SERVICE_ROLE_KEY=your-service-key
```

### 3. 检查构建是否成功
```bash
# 手动构建并查看错误
npm run build

# 如果构建失败,查看具体错误信息
```

### 4. 检查端口和进程
```bash
# 查看端口是否被占用
netstat -tulpn | grep :3000

# 或使用 lsof
lsof -i :3000

# 查看 Node.js 进程
ps aux | grep node
```

---

## 🎯 推荐的部署流程

### 完整命令(在本地执行)
```bash
# 1. 提交代码
git add .
git commit -m "chore: 添加数据库诊断工具"
git push origin main
```

### 完整命令(在 VPS 上执行)
```bash
# 2. 更新代码
cd /path/to/your/project
git pull origin main

# 3. 安装依赖
npm install

# 4. 清理并重新构建
rm -rf .next
npm run build

# 5. 重启 PM2
pm2 restart your-app-name

# 6. 查看日志
pm2 logs your-app-name --lines 50
```

---

## 📊 常见错误和解决方案

### 错误 1: "column does not exist"
**原因:** 数据库字段缺失
**解决:** 在 Supabase Dashboard 执行 `scripts/999_comprehensive_fix.sql`

### 错误 2: "relation does not exist"
**原因:** 数据库表缺失
**解决:** 在 Supabase Dashboard 执行 `scripts/999_comprehensive_fix.sql`

### 错误 3: 构建失败 "Module not found"
**原因:** 依赖没有安装
**解决:**
```bash
rm -rf node_modules package-lock.json
npm install
npm run build
```

### 错误 4: PM2 启动失败
**原因:** 端口被占用或配置错误
**解决:**
```bash
# 查看完整的 PM2 配置
pm2 show your-app-name

# 删除并重新创建
pm2 delete your-app-name
pm2 start npm --name "your-app-name" -- start
```

### 错误 5: 环境变量问题
**原因:** .env 文件配置错误
**解决:**
```bash
# 确保 .env 文件存在
ls -la | grep .env

# 检查内容
cat .env.local

# 如果缺失,从本地复制
# (在本地)
scp .env.local username@vps-ip:/path/to/project/
```

---

## ✅ 验证部署成功

### 1. 检查 PM2 状态
```bash
pm2 status
# 应该显示 'online' 状态
```

### 2. 访问网站
```bash
# 在浏览器中访问
https://your-domain.com
# 或
http://your-vps-ip:3000
```

### 3. 查看实时日志
```bash
pm2 logs your-app-name
# 应该没有错误信息
```

---

## 💡 最佳实践建议

### 1. 使用 PM2 配置文件
创建 `ecosystem.config.js`:
```javascript
module.exports = {
  apps: [{
    name: 'merchant-platform',
    script: 'npm',
    args: 'start',
    cwd: '/path/to/your/project',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G'
  }]
}
```

启动:
```bash
pm2 start ecosystem.config.js
```

### 2. 自动化部署脚本
创建 `deploy.sh`:
```bash
#!/bin/bash
set -e

echo "🚀 开始部署..."

# 拉取代码
git pull origin main

# 安装依赖
npm install

# 构建
rm -rf .next
npm run build

# 重启服务
pm2 restart merchant-platform

# 查看日志
pm2 logs merchant-platform --lines 20

echo "✅ 部署完成!"
```

使用:
```bash
chmod +x deploy.sh
./deploy.sh
```

---

## 📞 需要帮助?

如果部署过程中遇到问题,请提供:
1. PM2 日志内容
2. 构建错误信息
3. 浏览器控制台错误
4. VPS 系统信息 (Node.js 版本, npm 版本等)
