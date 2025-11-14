# Supabase pg_cron 定时任务设置指南

## 📋 概述

使用 Supabase 的 PostgreSQL `pg_cron` 扩展来实现商家置顶到期提醒功能。这是最优雅的解决方案,因为定时任务直接在数据库层面运行,无需外部服务或额外部署。

## ✨ 功能说明

### 1. 自动下架过期置顶 (`expire_top_merchants`)
- **频率**: 每小时运行一次
- **功能**: 自动取消已过期商家的置顶状态
- **通知**: 发送"商家置顶已到期"通知

### 2. 到期提醒 (`check_expiring_top_merchants`)
- **频率**: 每天上午10点(北京时间)
- **功能**: 检查3天内即将到期的置顶商家
- **通知**: 发送高优先级"商家置顶即将到期"通知
- **防重复**: 自动检测,避免重复发送通知

---

## 🚀 快速设置(5分钟完成)

### 步骤 1: 登录 Supabase Dashboard

1. 访问 https://app.supabase.com
2. 选择您的项目
3. 点击左侧菜单的 **"SQL Editor"**

### 步骤 2: 执行安装脚本

1. 在 SQL Editor 中创建新查询
2. 复制 `scripts/025_setup_pg_cron.sql` 的全部内容
3. 点击 **"Run"** 执行

脚本会自动:
- ✅ 启用 `pg_cron` 扩展
- ✅ 创建 `check_expiring_top_merchants()` 函数
- ✅ 创建 `expire_top_merchants()` 函数
- ✅ 设置两个定时任务

### 步骤 3: 验证安装

在 SQL Editor 中运行:

```sql
-- 查看已创建的定时任务
SELECT * FROM cron.job;
```

应该看到两条记录:
- `expire-top-merchants` - 每小时执行
- `check-expiring-top-merchants` - 每天2:00 UTC执行

### 步骤 4: 测试功能

手动测试函数是否正常工作:

```sql
-- 测试到期提醒功能
SELECT check_expiring_top_merchants();

-- 测试自动下架功能
SELECT expire_top_merchants();
```

查看输出的 NOTICE 消息了解执行情况。

### 步骤 5: 完成!

✅ 定时任务已自动运行,无需任何额外配置!

---

## 📊 定时任务详情

### 任务 1: 自动下架过期置顶

**Cron表达式**: `0 * * * *` (每小时整点)

```sql
SELECT cron.schedule(
  'expire-top-merchants',
  '0 * * * *',
  $$SELECT expire_top_merchants()$$
);
```

**执行时间示例**:
- 00:00, 01:00, 02:00, ..., 23:00 (UTC时间)

### 任务 2: 到期提醒

**Cron表达式**: `0 2 * * *` (每天 UTC 2:00 = 北京时间 10:00)

```sql
SELECT cron.schedule(
  'check-expiring-top-merchants',
  '0 2 * * *',
  $$SELECT check_expiring_top_merchants()$$
);
```

**执行时间**: 每天上午10:00 (北京时间)

---

## 🕐 时区说明

### 重要: pg_cron 使用 UTC 时间

如果您在中国(UTC+8),需要调整时间:
- UTC 2:00 = 北京时间 10:00
- UTC 14:00 = 北京时间 22:00

### 修改执行时间

如果想改成每天下午3点(北京时间)执行提醒:
- 北京时间 15:00 = UTC 7:00

```sql
-- 先删除旧任务
SELECT cron.unschedule('check-expiring-top-merchants');

-- 创建新任务(UTC 7:00)
SELECT cron.schedule(
  'check-expiring-top-merchants',
  '0 7 * * *',
  $$SELECT check_expiring_top_merchants()$$
);
```

---

## 🔍 监控和调试

### 查看定时任务列表

```sql
SELECT
  jobid,
  schedule,
  command,
  nodename,
  active
FROM cron.job;
```

### 查看任务执行历史

```sql
SELECT
  jobid,
  runid,
  start_time,
  end_time,
  status,
  return_message
FROM cron.job_run_details
ORDER BY start_time DESC
LIMIT 20;
```

### 查看最近的错误

```sql
SELECT *
FROM cron.job_run_details
WHERE status = 'failed'
ORDER BY start_time DESC
LIMIT 10;
```

### 查看最新通知

```sql
SELECT
  title,
  content,
  category,
  created_at,
  is_read
FROM notifications
WHERE category IN ('merchant_top_expiring', 'merchant_top_expired')
ORDER BY created_at DESC
LIMIT 10;
```

---

## 🛠️ 管理定时任务

### 暂停任务

```sql
-- 暂停自动下架任务
UPDATE cron.job
SET active = FALSE
WHERE jobname = 'expire-top-merchants';

-- 暂停提醒任务
UPDATE cron.job
SET active = FALSE
WHERE jobname = 'check-expiring-top-merchants';
```

### 恢复任务

```sql
UPDATE cron.job
SET active = TRUE
WHERE jobname = 'expire-top-merchants';
```

### 删除任务

```sql
SELECT cron.unschedule('expire-top-merchants');
SELECT cron.unschedule('check-expiring-top-merchants');
```

### 重新创建任务

如果需要修改任务配置:

```sql
-- 1. 删除旧任务
SELECT cron.unschedule('expire-top-merchants');

-- 2. 创建新任务(修改时间或命令)
SELECT cron.schedule(
  'expire-top-merchants',
  '0 * * * *',  -- 修改这里的Cron表达式
  $$SELECT expire_top_merchants()$$
);
```

---

## 🧪 手动测试

### 创建测试数据

```sql
-- 创建一个即将到期的测试商家(2天后到期)
UPDATE merchants
SET
  is_topped = TRUE,
  topped_until = NOW() + INTERVAL '2 days'
WHERE id = 'your-merchant-id';
```

### 运行测试

```sql
-- 测试提醒功能
SELECT check_expiring_top_merchants();

-- 检查是否创建了通知
SELECT * FROM notifications
WHERE category = 'merchant_top_expiring'
ORDER BY created_at DESC
LIMIT 5;
```

### 创建过期测试数据

```sql
-- 创建一个已过期的测试商家
UPDATE merchants
SET
  is_topped = TRUE,
  topped_until = NOW() - INTERVAL '1 day'
WHERE id = 'your-merchant-id';

-- 测试自动下架
SELECT expire_top_merchants();

-- 检查商家是否被下架
SELECT id, name, is_topped, topped_until
FROM merchants
WHERE id = 'your-merchant-id';

-- 检查是否发送了通知
SELECT * FROM notifications
WHERE category = 'merchant_top_expired'
ORDER BY created_at DESC
LIMIT 5;
```

---

## 📈 性能优化

### 索引优化

脚本已包含必要的索引,但如果数据量很大,可以添加:

```sql
-- 为 topped_until 添加索引
CREATE INDEX IF NOT EXISTS idx_merchants_topped_until
ON merchants(topped_until)
WHERE is_topped = TRUE;
```

### 批量处理

如果商家数量非常多(10000+),可以修改函数使用批量操作:

```sql
-- 批量下架(示例)
UPDATE merchants
SET is_topped = FALSE, topped_until = NULL
WHERE is_topped = TRUE
  AND topped_until IS NOT NULL
  AND topped_until < NOW()
RETURNING id, user_id, name;
```

---

## ❗ 故障排查

### 问题 1: 扩展不可用

**错误**: `extension "pg_cron" is not available`

**原因**: Supabase 项目可能不支持 pg_cron

**解决**:
1. 检查 Supabase 计划(某些计划可能不支持)
2. 联系 Supabase 支持启用 pg_cron
3. 或使用备选方案(API + 外部Cron)

### 问题 2: 任务没有执行

**检查步骤**:

```sql
-- 1. 检查任务是否激活
SELECT * FROM cron.job WHERE active = TRUE;

-- 2. 查看执行历史
SELECT * FROM cron.job_run_details
ORDER BY start_time DESC LIMIT 5;

-- 3. 手动执行测试
SELECT expire_top_merchants();
```

### 问题 3: 权限错误

**错误**: `permission denied`

**解决**: 确保函数使用 `SECURITY DEFINER` 创建,脚本已包含。

### 问题 4: 时区问题

**症状**: 任务在错误的时间执行

**解决**: 调整 Cron 表达式,记住 pg_cron 使用 UTC 时间。

---

## 🔄 Cron 表达式参考

```
┌───────────── 分钟 (0 - 59)
│ ┌───────────── 小时 (0 - 23)
│ │ ┌───────────── 日期 (1 - 31)
│ │ │ ┌───────────── 月份 (1 - 12)
│ │ │ │ ┌───────────── 星期 (0 - 7) (0和7都代表星期日)
│ │ │ │ │
* * * * *
```

### 常用示例

```sql
'0 * * * *'      -- 每小时整点
'0 */2 * * *'    -- 每2小时
'0 0 * * *'      -- 每天午夜 (UTC)
'0 2 * * *'      -- 每天 2:00 UTC (北京时间10:00)
'0 14 * * *'     -- 每天 14:00 UTC (北京时间22:00)
'0 0 * * 0'      -- 每周日午夜
'0 0 1 * *'      -- 每月1日午夜
'*/15 * * * *'   -- 每15分钟
'30 9 * * 1-5'   -- 工作日上午9:30 UTC
```

---

## 📦 完整文件列表

- **`scripts/025_setup_pg_cron.sql`** - 完整安装脚本
- **`SUPABASE_PGCRON_GUIDE.md`** - 本文档

---

## 🎯 优势总结

使用 Supabase pg_cron 的优势:

✅ **无需外部服务** - 完全在数据库内运行
✅ **零成本** - Supabase 免费提供
✅ **高可靠** - 数据库级别保证
✅ **易维护** - 纯 SQL,无需额外代码
✅ **实时性好** - 直接操作数据库
✅ **自动备份** - 跟随数据库备份

---

## 📞 支持

如果遇到问题:

1. 检查 Supabase 文档: https://supabase.com/docs/guides/database/extensions/pgcron
2. 查看 pg_cron GitHub: https://github.com/citusdata/pg_cron
3. 联系 Supabase 支持

---

## 🎉 完成!

现在您的商家置顶到期提醒系统已经通过 Supabase pg_cron 完全自动化运行了!

定时任务将会:
- ⏰ 每小时自动检查并下架过期商家
- ⏰ 每天上午10点发送到期提醒
- 📧 自动创建通知到用户的通知中心
- 🔔 通过 Realtime 实时推送到用户界面

完全无需人工干预! 🚀
