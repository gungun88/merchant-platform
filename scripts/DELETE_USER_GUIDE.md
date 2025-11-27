# 用户销号脚本使用说明

## 📋 功能说明

`delete_user_account.js` 脚本用于完整删除用户账户及其所有相关数据，适用于用户申请销号的场景。

## ⚠️ 重要警告

- **此操作不可逆**：删除后无法恢复用户数据
- **建议先备份**：执行删除前建议先备份相关数据
- **需要管理员权限**：需要使用 Service Role Key

## 🎯 删除范围

脚本会删除以下所有与用户相关的数据：

1. ✅ **auth.users** - 用户认证信息
2. ✅ **profiles** - 用户档案信息
3. ✅ **point_transactions** - 积分交易记录
4. ✅ **points_log** - 旧积分记录
5. ✅ **notifications** - 通知消息
6. ✅ **invitations** - 邀请记录（作为邀请人/被邀请人）
7. ✅ **merchants** - 商家信息（如果是商家）
8. ✅ **favorites** - 收藏记录
9. ✅ **checkins** - 签到记录
10. ✅ **contact_views** - 查看联系方式记录
11. ✅ **deposit_merchant_applications** - 押金商家申请
12. ✅ **deposit_merchants** - 押金商家记录
13. ✅ **admin_logs** - 管理员日志（如果是管理员）
14. ✅ **beta_code_usages** - 内测码使用记录

## 📦 使用方法

### 基本用法

```bash
node scripts/delete_user_account.js <用户邮箱>
```

### 示例

```bash
# 删除指定邮箱的用户账户
node scripts/delete_user_account.js user@example.com
```

## 🔧 前置要求

1. **环境变量配置**

确保已配置以下环境变量：

```bash
NEXT_PUBLIC_SUPABASE_URL=你的Supabase项目URL
SUPABASE_SERVICE_ROLE_KEY=你的ServiceRoleKey
```

2. **安装依赖**

```bash
npm install @supabase/supabase-js
```

## 📝 执行流程

脚本执行时会按以下步骤进行：

### 1. 查找用户

```
🔍 正在查找用户: user@example.com

✅ 找到用户:
   ID: xxx-xxx-xxx
   邮箱: user@example.com
   注册时间: 2025-11-27
   用户名: testuser
   积分: 200
   角色: user
   是否商家: 否
```

### 2. 统计相关数据

```
📊 统计用户相关数据:

   积分交易记录 (point_transactions): 2
   旧积分记录 (points_log): 0
   通知 (notifications): 2
   作为邀请人 (invitations): 0
   作为被邀请人 (invitations): 1
   商家信息 (merchants): 0
   收藏记录 (favorites): 0
   签到记录 (checkins): 0
   查看联系方式 (contact_views): 0
   押金商家申请 (deposit_applications): 0
   押金商家记录 (deposit_merchants): 0
   管理员日志 (admin_logs): 0
   内测码使用 (beta_code_usages): 1

   📦 总计: 6 条相关数据
```

### 3. 确认删除

脚本会要求**两次确认**以防止误删：

```
⚠️  警告: 此操作不可逆!
   删除后将无法恢复用户数据
   建议在删除前先备份数据

确认要删除用户 user@example.com 吗? (yes/no): yes

请再次输入用户邮箱以确认删除: user@example.com
```

### 4. 执行删除

```
🗑️  开始删除用户数据...

   删除积分交易记录...
     ✅ 完成
   删除旧积分记录...
     ✅ 完成
   删除通知...
     ✅ 完成
   ...（省略其他步骤）
   删除 auth 用户...
     ✅ 完成

✅ 删除完成! 共处理 15 个操作

🎉 用户 user@example.com 已成功删除

✨ 操作成功完成
```

## 🛡️ 安全机制

1. **邮箱验证**：需要输入两次邮箱进行确认
2. **详细统计**：删除前显示所有相关数据统计
3. **逐步删除**：按照正确的依赖顺序删除数据
4. **错误提示**：每一步出错都会有明确提示
5. **Service Role**：使用服务端密钥绕过 RLS 权限限制

## ❌ 常见错误处理

### 错误1: 缺少环境变量

```
❌ 缺少环境变量:
   NEXT_PUBLIC_SUPABASE_URL
   SUPABASE_SERVICE_ROLE_KEY
```

**解决方法**：检查 `.env.local` 文件是否正确配置

### 错误2: 未找到用户

```
❌ 未找到该邮箱对应的用户
```

**解决方法**：检查邮箱是否正确，或用户是否已被删除

### 错误3: 删除失败

```
⚠️  错误: Foreign key constraint violation
```

**可能原因**：
- 数据库外键约束问题
- 某些数据被其他记录引用

**解决方法**：检查数据库外键约束设置，确保级联删除正确配置

## 📚 使用场景

### 场景1: 用户申请销号

当用户主动申请删除账户时：

```bash
# 1. 与用户确认删除意愿
# 2. 告知用户数据删除后不可恢复
# 3. 执行删除脚本
node scripts/delete_user_account.js user@example.com
```

### 场景2: 测试用户清理

清理测试环境的测试用户：

```bash
# 删除测试用户
node scripts/delete_user_account.js test1@example.com
node scripts/delete_user_account.js test2@example.com
```

### 场景3: 违规用户处理

对于违反平台规则的用户：

```bash
# 1. 记录违规原因
# 2. 执行删除
node scripts/delete_user_account.js banned@example.com
```

## 🔄 数据备份建议

在删除用户前，建议先备份相关数据：

```sql
-- 备份用户信息
SELECT * FROM profiles WHERE id = 'user-id';

-- 备份积分记录
SELECT * FROM point_transactions WHERE user_id = 'user-id';

-- 备份商家信息（如果是商家）
SELECT * FROM merchants WHERE user_id = 'user-id';
```

## ⚙️ 技术细节

### 删除顺序

脚本按照以下顺序删除数据，避免外键约束错误：

1. 子表数据（积分、通知、邀请等）
2. 关联表数据（商家、收藏等）
3. profiles 表
4. auth.users 表（最后删除）

### Service Role Key

脚本使用 Service Role Key 以绕过 Row Level Security (RLS) 限制，确保能够删除所有相关数据。

### 错误处理

每个删除操作都有独立的错误处理，即使某个步骤失败，也会继续执行后续步骤。

## 📞 常见问题

### Q: 删除后能恢复吗？

A: 不能。删除操作是永久性的，无法恢复。

### Q: 删除需要多长时间？

A: 通常在几秒内完成，具体取决于用户数据量。

### Q: 会影响其他用户吗？

A: 不会。只删除指定用户的数据，不影响其他用户。

### Q: 删除商家会影响用户的收藏吗？

A: 是的。如果删除的是商家用户，其他用户对该商家的收藏也会被删除（级联删除）。

### Q: 可以批量删除吗？

A: 当前脚本设计为单个用户删除。如需批量删除，建议编写额外的批处理脚本。

## 📝 TODO

未来可能的改进：

- [ ] 添加数据导出功能（删除前自动备份）
- [ ] 支持批量删除多个用户
- [ ] 添加删除日志记录
- [ ] 提供"软删除"选项（标记为已删除但不真正删除）
- [ ] 添加删除统计报告

## 📄 相关文档

- [Supabase Auth Admin API](https://supabase.com/docs/reference/javascript/auth-admin-deleteuser)
- [Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)

---

**最后更新**: 2025-11-27
**维护者**: Claude Code
