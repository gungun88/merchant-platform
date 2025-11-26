# 生产环境部署检查清单

## 问题分析

从截图看:
1. ✅ 前端日志显示正常 (浏览器控制台有输出)
2. ❌ **没有看到后端日志** (应该有 `[批量转账]` 开头的服务器日志)

**结论: 生产环境可能还在运行旧代码!**

## 立即检查步骤

### 1. 登录生产服务器

```bash
ssh your-username@your-production-server
```

### 2. 进入项目目录

```bash
cd /path/to/merchant-platform
# 例如: cd /var/www/merchant-platform
```

### 3. 检查当前代码版本

```bash
# 查看当前 git 提交
git log -1 --oneline

# 应该显示:
# 9c379e5 fix: 增加批量转账时间判断阈值到2分钟
```

**如果不是这个提交,说明代码没有更新!**

### 4. 拉取最新代码

```bash
git fetch origin
git status  # 查看是否有未提交的更改
git pull origin main
```

### 5. 安装依赖并构建

```bash
npm install
npm run build
```

### 6. 重启应用

```bash
# 如果使用 pm2
pm2 restart merchant-platform
pm2 logs merchant-platform --lines 50  # 查看日志

# 如果使用 systemd
sudo systemctl restart your-service-name
sudo journalctl -u your-service-name -n 50 -f

# 如果直接运行 Node.js
pkill -f "node.*next"
npm start
```

### 7. 验证部署

#### 方法1: 查看构建时间
```bash
ls -lh .next/BUILD_ID
cat .next/BUILD_ID
```

#### 方法2: 查看服务器日志
```bash
# pm2
pm2 logs merchant-platform --lines 0  # 清空后重新显示

# systemd
sudo journalctl -u your-service-name -f
```

#### 方法3: 触发批量转账并查看日志

1. 打开浏览器: https://merchant.doingfb.com/admin/users
2. 点击"批量转账"
3. 填写信息并确认
4. **同时查看服务器终端**,应该看到:

```
[批量转账] 接收到的活动日期: 2025-11-27T03:04:00.000Z
[批量转账] scheduledTime: Thu Nov 27 2025 03:04:00 GMT+0800 时间戳: 1764183840000
[批量转账] now: Thu Nov 27 2025 03:12:09 GMT+0800 时间戳: 1764184329412
[批量转账] 时间差(秒): -489.412
[批量转账] 时间差(ms): -489412 时间差(分钟): -8.156866666666666 是否定时: false
[批量转账] ⚠️ 选择的时间在过去,强制立即执行
```

**如果没有看到这些日志,说明代码没有更新或应用没有重启!**

## 常见问题排查

### 问题1: git pull 失败

```bash
# 查看是否有本地更改
git status

# 如果有未提交的更改,先备份
git stash

# 然后拉取
git pull origin main

# 恢复备份(如果需要)
git stash pop
```

### 问题2: npm install 失败

```bash
# 清理缓存
rm -rf node_modules package-lock.json
npm install
```

### 问题3: pm2 没有重启成功

```bash
# 查看 pm2 进程列表
pm2 list

# 完全删除并重新启动
pm2 delete merchant-platform
pm2 start npm --name merchant-platform -- start

# 保存配置
pm2 save
```

### 问题4: 端口被占用

```bash
# 查看端口占用
sudo lsof -i :3000  # 或你的端口号

# 杀死占用端口的进程
sudo kill -9 <PID>
```

## 部署后验证清单

- [ ] Git 提交是最新的 (9c379e5)
- [ ] npm run build 成功
- [ ] 应用已重启
- [ ] 服务器日志显示应用启动成功
- [ ] 浏览器能正常访问网站
- [ ] 执行批量转账时能看到服务器日志输出
- [ ] 批量转账功能正常工作

## 如果还是不行

如果按照上述步骤操作后问题依然存在,请提供以下信息:

1. `git log -1` 的输出
2. `pm2 list` 或 `ps aux | grep node` 的输出
3. 服务器日志 (执行批量转账时的完整日志)
4. `node -v` 和 `npm -v` 的输出

这样我可以进一步诊断问题。
