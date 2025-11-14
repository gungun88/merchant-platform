# 商家置顶到期提醒 - 快速参考

## 🚀 5分钟快速设置

### 1️⃣ 登录 Supabase
访问: https://app.supabase.com → 选择项目 → SQL Editor

### 2️⃣ 执行脚本
复制并运行: `scripts/025_setup_pg_cron.sql`

### 3️⃣ 验证安装
```sql
SELECT * FROM cron.job;
```

### 4️⃣ 完成!
定时任务已自动运行 🎉

---

## 📋 功能清单

| 功能 | 频率 | 说明 |
|-----|------|------|
| 自动下架过期商家 | 每小时 | 取消过期置顶,发送通知 |
| 到期提醒 | 每天10:00 | 提前3天提醒商家续费 |

---

## 🔍 常用命令

### 查看任务列表
```sql
SELECT * FROM cron.job;
```

### 查看执行历史
```sql
SELECT * FROM cron.job_run_details
ORDER BY start_time DESC LIMIT 10;
```

### 手动测试
```sql
-- 测试提醒功能
SELECT check_expiring_top_merchants();

-- 测试自动下架
SELECT expire_top_merchants();
```

### 查看最新通知
```sql
SELECT * FROM notifications
WHERE category IN ('merchant_top_expiring', 'merchant_top_expired')
ORDER BY created_at DESC LIMIT 10;
```

---

## 🛠️ 管理命令

### 暂停任务
```sql
UPDATE cron.job SET active = FALSE
WHERE jobname = 'expire-top-merchants';
```

### 恢复任务
```sql
UPDATE cron.job SET active = TRUE
WHERE jobname = 'expire-top-merchants';
```

### 删除任务
```sql
SELECT cron.unschedule('expire-top-merchants');
```

---

## ⏰ Cron 时间参考

| 表达式 | 说明 |
|--------|------|
| `0 * * * *` | 每小时整点 |
| `0 2 * * *` | 每天 2:00 UTC (北京时间10:00) |
| `0 */6 * * *` | 每6小时 |
| `*/30 * * * *` | 每30分钟 |

**重要**: pg_cron 使用 UTC 时间!
- UTC 2:00 = 北京时间 10:00
- UTC 14:00 = 北京时间 22:00

---

## 📁 相关文件

- **安装脚本**: `scripts/025_setup_pg_cron.sql`
- **详细指南**: `SUPABASE_PGCRON_GUIDE.md`
- **API方案**: `CRON_SETUP_GUIDE.md` (备选方案)

---

## ✅ 优势

- ✨ 无需外部服务
- 💰 完全免费
- 🔒 数据库级别可靠
- 🎯 纯SQL实现
- ⚡ 实时性好

---

## 📞 支持

问题? 查看完整指南: `SUPABASE_PGCRON_GUIDE.md`
