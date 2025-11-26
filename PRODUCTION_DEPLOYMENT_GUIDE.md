# 🚀 生产环境部署完整指南

## 📋 本次修复的问题清单

### ✅ 已修复的代码问题
1. **批量转账积分不到账** - `lib/actions/users.ts`
   - 改用 `record_point_transaction` RPC 函数
   - 确保事务一致性和并发安全

2. **新用户注册积分重复** - 需要执行 SQL 脚本
   - 触发器设置初始积分后,RPC 又加了一次
   - 导致用户获得 200 积分(应该是 100)

3. **新用户缺少用户编号和积分** - 需要执行 SQL 脚本
   - 触发器没有正确设置用户编号
   - 某些用户积分为 0

---

## 🔧 第一步: 执行 Supabase SQL 修复脚本

### 1.1 修复积分重复问题

**打开:** https://supabase.com/dashboard
**进入:** SQL Editor

**执行脚本:** `scripts/999_fix_duplicate_points.sql`

**这个脚本会:**
- ✅ 修改 `handle_new_user` 触发器(设置初始积分为 0)
- ✅ 让 `record_point_transaction` 负责添加注册积分
- ✅ 自动修复积分异常的用户(200 → 100)
- ✅ 记录修复日志

**预期结果:**
```sql
✅ 积分重复问题修复完成
触发器已更新，现有用户积分已修正
```

---

### 1.2 修复新用户注册问题

**继续在 SQL Editor 中执行:** `scripts/999_fix_new_user_registration.sql`

**这个脚本会:**
- ✅ 重建用户编号序列
- ✅ 重建 `assign_user_number` 触发器
- ✅ 完善 `handle_new_user` 触发器(包含详细日志)
- ✅ 修复所有缺少用户编号和积分的用户
- ✅ 验证修复结果

**预期结果:**
```sql
✅ 新用户注册修复完成
所有触发器已重建，现有用户数据已修复
```

---

## 🧪 第二步: 本地验证修复

### 2.1 验证数据库修复
```bash
# 检查用户数据问题
node scripts/check_user_issues.js
```

**预期输出:**
```
✅ 正常用户: 50
❌ 有问题的用户: 0

✅ 所有用户数据正常!
```

### 2.2 测试批量转账功能
1. 访问 http://localhost:3002/admin/users
2. 点击"批量转账"
3. 输入:
   - 积分: 10
   - 原因: 测试修复
   - 日期: 今天
4. 执行转账
5. **检查用户积分是否正确到账**

### 2.3 测试新用户注册
1. 访问 http://localhost:3002/auth/register
2. 注册一个新用户
3. 检查:
   - ✅ 用户编号存在
   - ✅ 积分为 100(不是 200)
   - ✅ 收到欢迎通知

---

## 📦 第三步: 提交代码到 GitHub

### 3.1 查看修改的文件
```bash
git status
```

### 3.2 提交所有修改
```bash
# 添加所有文件
git add .

# 提交
git commit -m "fix: 修复多个关键问题

- fix: 批量转账积分不到账,改用RPC函数确保事务一致性
- fix: 新用户注册积分重复(200→100)
- fix: 新用户缺少用户编号和积分
- docs: 添加完整的诊断和修复文档
- chore: 添加数据库诊断工具和修复脚本
"

# 推送到 GitHub
git push origin main
```

---

## 🚀 第四步: 部署到 VPS 生产环境

### 4.1 SSH 连接到 VPS
```bash
ssh your-username@your-vps-ip
```

### 4.2 更新代码
```bash
# 进入项目目录
cd /path/to/your/project

# 拉取最新代码
git pull origin main

# 查看拉取的文件
git log -1 --stat
```

### 4.3 安装依赖(如果有新的)
```bash
npm install
```

### 4.4 清理并重新构建
```bash
# 清理旧的构建
rm -rf .next

# 重新构建生产版本
npm run build
```

**预期输出:**
```
✓ Creating an optimized production build...
✓ Compiled successfully
✓ Collecting page data...
✓ Generating static pages...
✓ Finalizing page optimization...
```

### 4.5 重启 PM2
```bash
# 重启应用
pm2 restart your-app-name

# 查看状态
pm2 status

# 查看日志(确认没有错误)
pm2 logs your-app-name --lines 50
```

---

## ✅ 第五步: 生产环境验证

### 5.1 检查应用状态
```bash
# 查看 PM2 状态
pm2 status

# 应该显示 'online'
```

### 5.2 测试批量转账功能
1. 访问 https://merchant.doingfb.com/admin/users
2. 执行一次小额批量转账(如 1 积分)
3. **检查用户积分是否正确到账**
4. **检查积分记录是否正确**

### 5.3 测试新用户注册
1. 注册一个测试账号
2. 检查:
   - ✅ 用户编号存在
   - ✅ 积分为 100
   - ✅ 收到欢迎通知

### 5.4 检查错误日志
```bash
# 查看 PM2 错误日志
pm2 logs your-app-name --err --lines 20

# 应该没有新的错误
```

---

## 🎯 修复验证清单

### 数据库修复验证
- [ ] SQL 脚本 `999_fix_duplicate_points.sql` 执行成功
- [ ] SQL 脚本 `999_fix_new_user_registration.sql` 执行成功
- [ ] 所有用户都有用户编号
- [ ] 新用户积分为 100(不是 200)

### 代码修复验证
- [ ] 批量转账功能正常,积分正确到账
- [ ] 新用户注册功能正常
- [ ] 没有新的错误日志

### 部署验证
- [ ] 代码已提交到 GitHub
- [ ] VPS 已拉取最新代码
- [ ] 应用已重新构建
- [ ] PM2 状态为 'online'
- [ ] 生产环境功能正常

---

## 📊 修复影响范围

### 受影响的功能
1. ✅ **批量转账** - 管理员后台
2. ✅ **新用户注册** - 注册页面
3. ✅ **用户积分系统** - 所有积分相关功能

### 受影响的用户
- **所有新注册用户** - 确保正确获得积分和用户编号
- **所有参与批量转账活动的用户** - 确保积分到账

---

## 🔍 故障排查

### 问题 1: SQL 脚本执行失败
**症状:** Supabase 返回错误
**解决:**
```sql
-- 查看具体错误信息
-- 检查触发器是否存在
SELECT trigger_name FROM information_schema.triggers
WHERE trigger_schema = 'public';

-- 检查函数是否存在
SELECT routine_name FROM information_schema.routines
WHERE routine_schema = 'public';
```

### 问题 2: 构建失败
**症状:** `npm run build` 报错
**解决:**
```bash
# 清理依赖重新安装
rm -rf node_modules package-lock.json
npm install
npm run build
```

### 问题 3: PM2 启动失败
**症状:** PM2 显示 'errored' 状态
**解决:**
```bash
# 查看详细错误
pm2 logs your-app-name --err

# 删除并重新启动
pm2 delete your-app-name
pm2 start npm --name "your-app-name" -- start
```

### 问题 4: 批量转账仍然不到账
**症状:** 积分没有增加
**解决:**
```bash
# 检查 Supabase 日志
# Dashboard → Logs → PostgreSQL Logs

# 查看是否有 RPC 错误
```

---

## 📝 重要提示

### ⚠️ 部署前确认
1. ✅ **已在本地测试通过**
2. ✅ **已执行 SQL 修复脚本**
3. ✅ **已提交代码到 GitHub**
4. ✅ **已备份重要数据**(如果需要)

### ⚠️ 部署时注意
1. 🕐 **选择低峰期部署**(如凌晨)
2. 📊 **监控错误日志**
3. 🔄 **准备好回滚方案**(保留旧代码)

### ⚠️ 部署后监控
1. 📈 **监控 PM2 状态**
2. 📝 **检查错误日志**
3. 👥 **观察用户反馈**

---

## 🎉 预期成果

### 修复后的效果
- ✅ 批量转账功能正常,积分准确到账
- ✅ 新用户注册获得正确的积分(100)
- ✅ 新用户自动获得用户编号
- ✅ 所有积分交易都有正确的记录
- ✅ 没有重复发放积分

### 用户体验改善
- ✅ 批量转账活动积分准时到账
- ✅ 新用户注册体验正常
- ✅ 积分记录清晰准确

---

## 📞 需要帮助?

如果部署过程中遇到问题,请提供:
1. 错误日志内容
2. PM2 状态截图
3. Supabase SQL 执行结果
4. 具体的错误现象

---

## 🏁 部署完成确认

部署完成后,请确认:
- [ ] VPS 应用运行正常
- [ ] 批量转账功能测试通过
- [ ] 新用户注册测试通过
- [ ] 没有新的错误日志
- [ ] 用户反馈正常

**部署完成时间:** _____________

**部署人员:** _____________

**验证人员:** _____________
