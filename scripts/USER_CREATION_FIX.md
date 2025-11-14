# 修复用户创建问题

## 问题描述
管理员通过"添加用户"功能创建用户时出现 "Database error creating new user" 错误。

## 原因分析
数据库触发器 `handle_new_user()` 在执行时遇到错误，可能是因为：
1. `record_point_transaction` 函数调用时机问题
2. `create_notification` 函数调用时机问题
3. 缺少错误处理机制，一个步骤失败导致整个触发器失败

## 解决方案

### 方法 1: 执行 SQL 修复脚本（推荐）

1. 打开 Supabase Dashboard
2. 进入 SQL Editor
3. 打开文件 `scripts/056_fix_user_creation_trigger.sql`
4. 复制内容并在 SQL Editor 中执行
5. 等待执行完成
6. 返回应用，重试添加用户

### 方法 2: 检查数据库日志

如果方法 1 不起作用，可以：
1. 打开 Supabase Dashboard
2. 进入 Logs -> Postgres Logs
3. 查找包含 "handle_new_user" 或 "ERROR" 的日志
4. 根据具体错误信息进一步排查

## 测试步骤

修复后，请按以下步骤测试：

1. 访问 http://localhost:3003/admin/users
2. 点击"添加用户"按钮
3. 填写以下信息：
   - 用户名: test_user_001
   - 邮箱: test001@example.com
   - 密码: test123456
   - 不勾选"需要邮箱验证"
4. 点击"添加用户"
5. 检查是否创建成功

## 相关文件

- `scripts/056_fix_user_creation_trigger.sql` - 修复脚本
- `lib/actions/users.ts:508` - 创建用户的服务端代码
- `scripts/046_update_registration_trigger_use_settings.sql` - 原始触发器代码

## 已完成的诊断

✅ Service Role Key 权限正常
✅ `record_point_transaction` 函数存在
✅ `create_notification` 函数存在
✅ `generate_invitation_code` 函数存在
✅ `system_settings` 表正常
