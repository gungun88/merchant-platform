# 数据库和代码问题诊断报告

## 生成时间
2025-01-26

## 问题概述
网站出现功能错误,需要全面检查数据库和代码,找出潜在的 bug。

---

## 🔍 已发现的主要问题

### 1. SQL 脚本混乱
**问题描述:**
- 存在大量重复和冲突的 SQL 迁移脚本
- 同一个字段被多次添加(如 `pin_type`, `deposit_bonus_claimed`)
- 生产环境和开发环境的脚本不一致

**影响范围:**
- `merchants` 表: 多次添加 `pin_type`, `pin_expires_at` 等字段
- `profiles` 表: 多次添加 `role`, `user_number` 等字段

**修复建议:**
✅ 已创建综合修复脚本: `scripts/999_comprehensive_fix.sql`

---

### 2. 表字段可能缺失

**merchants 表关键字段:**
- `is_deposit_merchant` - 是否为押金商家
- `deposit_status` - 押金状态
- `deposit_amount` - 押金金额
- `deposit_bonus_claimed` - 押金奖励是否已领取
- `pin_type` - 置顶类型 (self/admin)
- `pin_expires_at` - 置顶到期时间
- `is_topped` - 是否置顶
- `topped_until` - 置顶截止时间
- `is_active` - 是否上架
- `credit_score` - 信用分

**profiles 表关键字段:**
- `user_number` - 用户编号(唯一)
- `points` - 用户积分
- `role` - 用户角色
- `is_merchant` - 是否为商家
- `invitation_code` - 邀请码
- `max_invitations` - 最大邀请次数
- `used_invitations` - 已使用邀请次数

**修复建议:**
✅ 已创建综合修复脚本,包含所有字段的添加

---

### 3. 表可能缺失

**需要检查的表:**
- `admin_operation_logs` - 管理员操作日志
- `deposit_top_up_applications` - 押金追加申请
- `user_notifications` - 用户通知(可能名为 `notifications`)

**修复建议:**
✅ 已创建综合修复脚本,包含缺失表的创建

---

### 4. 代码与数据库不一致

**问题位置: `lib/actions/merchant.ts`**

**第 427 行:**
```typescript
.select("*, profiles!inner(username, avatar, user_number, points)")
```
- 代码查询 `profiles.user_number` 和 `profiles.points`
- 如果数据库中这些字段不存在,会导致查询失败

**第 321-325 行:**
```typescript
const { data: currentMerchant } = await supabase
  .from("merchants")
  .select("is_topped, topped_until")
  .eq("id", merchantId)
  .maybeSingle()
```
- 查询 `is_topped` 和 `topped_until` 字段
- 如果字段不存在会失败

**第 344-353 行:**
```typescript
.update({
  is_topped: true,
  topped_until: toppedUntil.toISOString(),
  pin_type: "self",
  pin_expires_at: toppedUntil.toISOString(),
})
```
- 更新 `pin_type` 和 `pin_expires_at` 字段
- 如果字段不存在会失败

**修复建议:**
执行 `999_comprehensive_fix.sql` 脚本后,这些查询应该能正常工作

---

### 5. RLS 策略可能导致权限问题

**可能的问题:**
- 某些表启用了 RLS,但策略不完整
- 用户查询自己的数据时被 RLS 阻止

**修复建议:**
需要检查每个表的 RLS 策略是否正确

---

## 📋 诊断和修复步骤

### 步骤 1: 执行诊断脚本
```bash
# 在 Supabase SQL Editor 中执行
scripts/999_diagnose_database.sql
```

**这个脚本会检查:**
- ✅ merchants 表字段是否完整
- ✅ profiles 表字段是否完整
- ✅ 关键表是否存在
- ✅ 触发器和函数
- ✅ RLS 策略
- ✅ 索引
- ✅ 外键约束
- ✅ 数据一致性

### 步骤 2: 执行修复脚本
```bash
# 在 Supabase SQL Editor 中执行
scripts/999_comprehensive_fix.sql
```

**这个脚本会:**
- ✅ 为 merchants 表添加所有缺失字段
- ✅ 为 profiles 表添加所有缺失字段
- ✅ 创建缺失的表(admin_operation_logs, deposit_top_up_applications, user_notifications)
- ✅ 创建必要的索引
- ✅ 启用 RLS
- ✅ 迁移旧数据到新字段
- ✅ 为缺失用户编号的用户生成编号
- ✅ 验证修复结果

### 步骤 3: 清理缓存并重启
```bash
# 清理 Next.js 缓存
npm run build

# 重启开发服务器
npm run dev
```

---

## 🔧 可能导致功能错误的具体场景

### 场景 1: 商家列表页面加载失败
**原因:**
- `getMerchants()` 查询 `profiles.user_number` 或 `profiles.points` 不存在
- `merchants.is_active` 字段不存在

**报错信息可能包含:**
- "column profiles.user_number does not exist"
- "column merchants.is_active does not exist"

**修复:** 执行 `999_comprehensive_fix.sql`

---

### 场景 2: 商家置顶功能失败
**原因:**
- `merchants.pin_type` 或 `pin_expires_at` 字段不存在
- `merchants.is_topped` 或 `topped_until` 字段不存在

**报错信息可能包含:**
- "column merchants.pin_type does not exist"

**修复:** 执行 `999_comprehensive_fix.sql`

---

### 场景 3: 用户搜索功能失败
**原因:**
- 按用户编号搜索时,`profiles.user_number` 字段不存在

**报错信息可能包含:**
- "column profiles.user_number does not exist"

**修复:** 执行 `999_comprehensive_fix.sql`

---

### 场景 4: 管理员操作日志记录失败
**原因:**
- `admin_operation_logs` 表不存在

**报错信息可能包含:**
- "relation admin_operation_logs does not exist"

**修复:** 执行 `999_comprehensive_fix.sql`

---

### 场景 5: 押金追加申请功能失败
**原因:**
- `deposit_top_up_applications` 表不存在

**报错信息可能包含:**
- "relation deposit_top_up_applications does not exist"

**修复:** 执行 `999_comprehensive_fix.sql`

---

## 🚨 需要手动检查的项目

### 1. 检查 Supabase 错误日志
- 打开 Supabase Dashboard → Logs → PostgreSQL Logs
- 查看是否有 SQL 错误

### 2. 检查浏览器控制台
- 打开网站,按 F12
- 查看 Console 和 Network 标签
- 找出具体是哪个 API 调用失败

### 3. 检查 RLS 策略
```sql
-- 在 Supabase SQL Editor 中执行
SELECT
  tablename,
  policyname,
  cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

### 4. 检查触发器是否正常工作
```sql
-- 检查触发器
SELECT
  trigger_name,
  event_object_table,
  action_timing,
  event_manipulation
FROM information_schema.triggers
WHERE trigger_schema = 'public';
```

---

## 📌 后续建议

### 1. 统一迁移脚本管理
- ✅ 建议使用版本号命名: `001_xxx.sql`, `002_xxx.sql`
- ✅ 避免创建 `PRODUCTION_XXX.sql` 等特殊脚本
- ✅ 所有脚本都应该使用 `IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS`

### 2. 建立迁移记录表
```sql
CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  executed_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 3. 定期备份
- 建议每天自动备份数据库
- 在执行重要迁移前手动备份

### 4. 代码审查
- 检查所有 Supabase 查询
- 确保代码中使用的字段在数据库中存在
- 添加适当的错误处理

---

## ✅ 总结

**主要问题:**
1. ❌ SQL 脚本混乱,同一字段被多次添加
2. ❌ 数据库字段可能缺失
3. ❌ 某些表可能不存在
4. ❌ 代码查询的字段可能在数据库中不存在

**修复方案:**
1. ✅ 执行诊断脚本: `scripts/999_diagnose_database.sql`
2. ✅ 执行修复脚本: `scripts/999_comprehensive_fix.sql`
3. ✅ 清理缓存并重启应用
4. ✅ 检查错误日志确认修复

**预计修复时间:** 10-15 分钟

**风险评估:** 低风险
- 所有脚本都使用 `IF NOT EXISTS` 语法
- 不会删除任何数据
- 可以安全地重复执行
