-- ====================================================================
-- 配置合作伙伴到期提醒定时任务
-- 用途: 使用 Supabase pg_cron 每天检查即将到期的合作伙伴并发送通知
-- 执行频率: 每天凌晨 0:00 (UTC)
-- ====================================================================

-- 1. 启用 pg_cron 扩展（如果还没启用）
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2. 启用 http 扩展（用于发送 HTTP 请求）
CREATE EXTENSION IF NOT EXISTS http;

-- 3. 删除可能存在的旧定时任务（避免重复）
SELECT cron.unschedule('check-expiring-partners-daily')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'check-expiring-partners-daily'
);

-- 4. 创建定时任务：每天凌晨 0:00 检查即将到期的合作伙伴
-- 注意: 请将 'https://your-domain.com' 替换为你的实际域名
SELECT cron.schedule(
  'check-expiring-partners-daily',  -- 任务名称
  '0 0 * * *',                      -- Cron 表达式: 每天凌晨 0:00 (UTC)
  $$
  SELECT
    net.http_post(
      url := 'https://your-domain.com/api/cron/check-expiring-partners',
      headers := '{"Content-Type": "application/json"}'::jsonb,
      timeout_milliseconds := 30000
    ) AS request_id;
  $$
);

-- ====================================================================
-- 如果需要添加 Authorization 认证（推荐用于生产环境）
-- 取消下面的注释，并替换 'your-secret-key' 为你的实际密钥
-- ====================================================================

/*
-- 删除上面创建的任务
SELECT cron.unschedule('check-expiring-partners-daily');

-- 重新创建带认证的任务
SELECT cron.schedule(
  'check-expiring-partners-daily',
  '0 0 * * *',
  $$
  SELECT
    net.http_post(
      url := 'https://your-domain.com/api/cron/check-expiring-partners',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer your-secret-key'
      ),
      timeout_milliseconds := 30000
    ) AS request_id;
  $$
);
*/

-- ====================================================================
-- 管理命令（仅供参考，不会自动执行）
-- ====================================================================

-- 查看所有定时任务
-- SELECT * FROM cron.job;

-- 查看定时任务执行历史（最近10次）
-- SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;

-- 删除定时任务
-- SELECT cron.unschedule('check-expiring-partners-daily');

-- 手动触发测试（不会实际执行，仅用于验证 SQL 语法）
-- SELECT
--   net.http_post(
--     url := 'https://your-domain.com/api/cron/check-expiring-partners',
--     headers := '{"Content-Type": "application/json"}'::jsonb
--   ) AS request_id;

-- ====================================================================
-- 执行完成后的验证步骤
-- ====================================================================

-- 1. 验证任务是否创建成功
SELECT
  jobid,
  jobname,
  schedule,
  command,
  active
FROM cron.job
WHERE jobname = 'check-expiring-partners-daily';

-- 2. 等待下次执行后查看执行结果
-- SELECT
--   jobid,
--   runid,
--   job_pid,
--   database,
--   username,
--   command,
--   status,
--   return_message,
--   start_time,
--   end_time
-- FROM cron.job_run_details
-- WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'check-expiring-partners-daily')
-- ORDER BY start_time DESC
-- LIMIT 5;
