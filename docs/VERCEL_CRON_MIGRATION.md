# Vercel Cron 迁移到 pg_cron 完整指南

## 📋 迁移概述

本文档说明如何将原本在 Vercel 上运行的定时任务完全迁移到 Supabase pg_cron，实现**完全免费**的定时任务部署。

---

## 🎯 迁移原因

1. **项目不部署在 Vercel**：Vercel Cron 只在部署到 Vercel 时才会执行
2. **完全免费**：Supabase 免费计划支持 pg_cron，无数量限制
3. **更高性能**：数据库层面执行，无需 HTTP 请求开销
4. **统一管理**：所有定时任务集中在数据库中管理

---

## 📊 原 Vercel Cron 任务清单

| 任务路径 | 频率 | 功能 | 迁移状态 |
|---------|------|------|---------|
| `/api/cron/expire-tops` | 每小时 | 下架过期的置顶商家 | ✅ 已完成（任务9） |
| `/api/cron/check-expiring` | 每天10点 | 提醒3天内到期的置顶商家 | ✅ 本次迁移 |
| `/api/cron/check-expiring-partners` | 每天0点 | 提醒7天内到期的合作伙伴 | ✅ 本次迁移 |

---

## 🚀 迁移步骤

### 步骤 1：执行迁移脚本

1. 打开 Supabase SQL Editor
2. 打开脚本文件：[scripts/121_migrate_vercel_cron_to_pgcron.sql](scripts/121_migrate_vercel_cron_to_pgcron.sql)
3. 复制全部内容
4. 粘贴到 SQL Editor
5. 点击 **Run** 执行

脚本会自动：
- ✅ 创建 2 个新的数据库函数
- ✅ 配置 2 个新的定时任务
- ✅ 验证配置结果

### 步骤 2：验证任务配置

执行完成后，运行以下查询验证：

```sql
SELECT
  jobid,
  jobname,
  schedule,
  command,
  active
FROM cron.job
ORDER BY jobid;
```

你应该看到 **7 个定时任务**：

| Job ID | 任务名称 | 执行时间（北京） | 功能 |
|--------|---------|----------------|------|
| 5 | `banner-expire-beijing-0am-12pm` | 每天 0点 & 12点 | Banner过期禁用 |
| 6 | `checkin-reset-beijing-0am` | 每天 0点 | 签到重置 |
| 7 | `daily-reward-reset-beijing-5am` | 每天 5点 | 每日奖励重置 |
| 8 | `invitation-reset-beijing-monthly` | 每月1号 0点 | 邀请次数重置 |
| 9 | `topped-expire-hourly` | 每小时 | 置顶商家过期 |
| 10 | `topped-expiring-check-beijing-10am` | 每天 10点 | 置顶到期提醒 ⭐ 新增 |
| 11 | `partner-expiring-check-beijing-10am` | 每天 10点 | 合作伙伴到期提醒 ⭐ 新增 |

### 步骤 3：测试新函数

手动测试两个新函数是否正常工作：

```sql
-- 测试1: 置顶商家到期提醒
SELECT * FROM check_expiring_top_merchants();

-- 测试2: 合作伙伴到期提醒
SELECT * FROM check_expiring_partners();
```

返回的 `notification_count` 表示发送了多少条通知（可能为 0，说明暂时没有即将到期的）。

### 步骤 4：清理 Vercel Cron 配置（可选）

由于项目不部署在 Vercel，可以清空 `vercel.json` 中的 crons 配置：

**选项 A：完全清空**
```json
{
  "crons": []
}
```

**选项 B：保留配置但注释说明**
```json
{
  "crons": [
    // 已迁移到 Supabase pg_cron，以下配置仅作备份
  ]
}
```

**选项 C：删除整个 vercel.json 文件**（如果项目不使用 Vercel）

---

## 📅 最终的完整定时任务时间表

### **北京时间 0点（每天凌晨）**
- ✅ 禁用过期Banner
- ✅ 重置签到连续天数
- ✅ 重置月度邀请次数（每月1号）

### **北京时间 5点（每天早上）**
- ✅ 重置押金商家每日奖励

### **北京时间 10点（每天上午）**
- ✅ 置顶商家到期提醒（3天内）⭐ 新增
- ✅ 合作伙伴到期提醒（7天内）⭐ 新增

### **北京时间 12点（每天中午）**
- ✅ 禁用过期Banner

### **每小时整点**
- ✅ 置顶商家过期检查

---

## 🔍 监控与维护

### 查看最近执行记录

```sql
-- 查看所有任务的最近执行情况
SELECT
  j.jobname,
  d.status,
  d.return_message,
  d.start_time AT TIME ZONE 'Asia/Shanghai' as beijing_time,
  d.end_time - d.start_time as duration
FROM cron.job_run_details d
JOIN cron.job j ON j.jobid = d.jobid
WHERE d.start_time > NOW() - INTERVAL '24 hours'
ORDER BY d.start_time DESC
LIMIT 50;
```

### 查看失败的任务

```sql
SELECT
  j.jobname,
  d.return_message,
  d.start_time AT TIME ZONE 'Asia/Shanghai' as beijing_time
FROM cron.job_run_details d
JOIN cron.job j ON j.jobid = d.jobid
WHERE d.status = 'failed'
  AND d.start_time > NOW() - INTERVAL '7 days'
ORDER BY d.start_time DESC;
```

### 查看任务执行统计（最近7天）

```sql
SELECT
  j.jobname,
  COUNT(*) as total_runs,
  COUNT(CASE WHEN d.status = 'succeeded' THEN 1 END) as success_count,
  COUNT(CASE WHEN d.status = 'failed' THEN 1 END) as failed_count,
  ROUND(AVG(EXTRACT(EPOCH FROM (d.end_time - d.start_time))), 3) as avg_duration_seconds
FROM cron.job_run_details d
JOIN cron.job j ON j.jobid = d.jobid
WHERE d.start_time > NOW() - INTERVAL '7 days'
GROUP BY j.jobname
ORDER BY j.jobname;
```

---

## 🛠️ 管理命令

### 暂停某个任务

```sql
UPDATE cron.job
SET active = false
WHERE jobname = 'topped-expiring-check-beijing-10am';
```

### 恢复某个任务

```sql
UPDATE cron.job
SET active = true
WHERE jobname = 'topped-expiring-check-beijing-10am';
```

### 修改任务执行时间

```sql
-- 先删除旧任务
SELECT cron.unschedule('topped-expiring-check-beijing-10am');

-- 重新创建新时间的任务
SELECT cron.schedule(
  'topped-expiring-check-beijing-10am',
  '0 3 * * *',  -- 改为 UTC 3点 = 北京时间 11点
  $$SELECT check_expiring_top_merchants();$$
);
```

### 删除任务

```sql
SELECT cron.unschedule('任务名称');
```

---

## ✅ 迁移检查清单

- [ ] 执行迁移脚本 `121_migrate_vercel_cron_to_pgcron.sql`
- [ ] 验证 7 个任务都已配置成功
- [ ] 手动测试 2 个新函数
- [ ] 查看执行历史确认任务正常运行
- [ ] 清理或更新 `vercel.json` 配置
- [ ] （可选）删除 `app/api/cron/` 目录下的路由文件

---

## 📝 技术细节

### 新增的数据库函数

#### 1. `check_expiring_top_merchants()`
- **功能**：检查3天内即将到期的置顶商家
- **返回**：发送的通知数量
- **通知表**：`user_notifications`
- **通知类型**：`category = 'merchant_top_expiring'`

#### 2. `check_expiring_partners()`
- **功能**：检查7天内即将到期的合作伙伴
- **返回**：发送的通知数量
- **通知表**：`user_notifications`
- **通知类型**：`category = 'partner_expiring'`

### 时区转换

所有任务时间均按**北京时间**（UTC+8）配置：

| 北京时间 | UTC时间 | Cron表达式 |
|---------|---------|-----------|
| 0点 | 16点（前一天） | `0 16 * * *` |
| 5点 | 21点（前一天） | `0 21 * * *` |
| 10点 | 2点 | `0 2 * * *` |
| 12点 | 4点 | `0 4 * * *` |

---

## 💰 成本对比

| 方案 | 成本 | 限制 |
|------|------|------|
| **Vercel Cron** | $20/月（Pro Plan） | 有数量限制 |
| **Supabase pg_cron** | **完全免费** | 无数量限制 |
| **VPS Cron** | VPS费用 | 需要维护 |

---

## 🎉 总结

迁移完成后，你将拥有：

✅ **7 个定时任务**全部在 Supabase 免费计划中运行
✅ **完全免费**，无需任何额外费用
✅ **统一管理**，所有任务在数据库中配置
✅ **高性能**，数据库层面执行，无 HTTP 开销
✅ **易监控**，完整的执行历史和日志

---

## 📚 相关文件

- 迁移脚本：[scripts/121_migrate_vercel_cron_to_pgcron.sql](scripts/121_migrate_vercel_cron_to_pgcron.sql)
- 初始配置：[scripts/120_cleanup_and_setup_cron_beijing_time.sql](scripts/120_cleanup_and_setup_cron_beijing_time.sql)
- Vercel配置：[vercel.json](vercel.json)
- API路由：[app/api/cron/](app/api/cron/)

---

**完成时间**：2025-11-24
**维护周期**：建议每周检查一次执行历史
