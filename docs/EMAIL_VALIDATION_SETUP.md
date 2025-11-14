# 邮箱验证配置设置指南

## 步骤 1: 执行数据库迁移

由于 Supabase 的安全限制，需要手动在 Supabase Dashboard 执行 SQL 脚本。

### 方法 1: 通过 Supabase Dashboard（推荐）

1. 访问 [Supabase Dashboard](https://app.supabase.com)
2. 选择你的项目
3. 点击左侧菜单的 **SQL Editor**
4. 点击 **New query**
5. 复制并粘贴 `scripts/053_add_email_validation_settings.sql` 文件的内容
6. 点击 **Run** 执行

### 方法 2: 使用 Supabase CLI

如果你安装了 Supabase CLI：

```bash
supabase db push --file scripts/053_add_email_validation_settings.sql
```

### 方法 3: 使用 psql 命令行

如果你有数据库的直接访问权限：

```bash
psql -h your-db-host -U postgres -d postgres -f scripts/053_add_email_validation_settings.sql
```

## 步骤 2: 验证配置

执行完成后，运行以下命令验证：

```bash
node scripts/setup_email_validation.js
```

如果看到类似以下输出，说明配置成功：

```
ℹ️  邮箱验证字段已存在
   - 启用状态: true
   - 验证模式: both
   - 白名单数量: 21
   - 黑名单数量: 30
```

## 配置说明

### email_validation_enabled (Boolean)
- `true`: 启用邮箱验证
- `false`: 禁用邮箱验证（允许所有邮箱）

### email_validation_mode (String)
- `whitelist`: 仅白名单模式 - 只允许白名单中的邮箱域名
- `blacklist`: 仅黑名单模式 - 阻止黑名单中的邮箱域名
- `both`: 混合模式（推荐）- 同时检查黑名单和白名单
- `disabled`: 禁用验证

### email_allowed_domains (TEXT[])
允许的邮箱域名列表（白名单），默认包含：
- 国际主流: gmail.com, outlook.com, yahoo.com, icloud.com 等
- 中国主流: qq.com, 163.com, 126.com, sina.com 等

### email_blocked_domains (TEXT[])
禁止的邮箱域名列表（黑名单），默认包含：
- 临时邮箱: 10minutemail.com, tempmail.com, guerrillamail.com 等
- 中文临时邮箱: linshiyouxiang.net, 027168.com 等

## 后续步骤

配置完成后：

1. ✅ 注册页面会自动使用数据库配置进行验证
2. ✅ 管理员可以在后台设置页面修改配置
3. ✅ 无需重启应用或重新部署

## 常见问题

### Q: 为什么不能通过代码自动执行？
A: Supabase 的 Row Level Security (RLS) 和权限限制不允许通过客户端 SDK 执行 DDL 语句（如 ALTER TABLE）。需要使用 SQL Editor 或直接数据库访问。

### Q: 如何添加新的邮箱域名？
A: 配置完成后，可以在管理后台 > 系统设置 > 邮箱验证 中添加或删除域名。

### Q: 如何临时禁用邮箱验证？
A: 在管理后台将 `email_validation_enabled` 设置为 `false`，或将 `email_validation_mode` 设置为 `disabled`。
