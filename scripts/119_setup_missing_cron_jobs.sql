-- ============================================
-- 补充缺失的定时任务配置
-- 使用 Supabase pg_cron 实现
-- ============================================
--
-- 执行前请先检查现有任务：
-- SELECT * FROM cron.job;
--
-- 如果任务已存在，需要先删除：
-- SELECT cron.unschedule('任务名称');
-- ============================================

-- ============================================
-- 1. Banner 广告过期自动禁用
-- ============================================
-- 功能：自动禁用已过期的广告 Banner
-- 频率：每天 0点 和 12点 执行
-- 依赖：disable_expired_banners() 函数（已在 089 脚本中创建）

SELECT cron.schedule(
  'disable-expired-banners',           -- 任务名称
  '0 0,12 * * *',                      -- Cron 表达式：每天0点和12点
  $$SELECT disable_expired_banners();$$ -- 执行的 SQL 命令
);

COMMENT ON FUNCTION disable_expired_banners() IS
'定时任务：每天0点和12点自动禁用已过期的广告Banner';


-- ============================================
-- 2. 连续签到天数重置
-- ============================================
-- 功能：重置用户断签的连续签到天数
-- 频率：每天凌晨 0点 执行
-- 逻辑：如果用户的 last_checkin 不是今天，则将 consecutive_checkin_days 重置为 0

-- 创建重置函数
CREATE OR REPLACE FUNCTION reset_broken_checkin_streaks()
RETURNS void AS $$
DECLARE
  affected_count INTEGER;
BEGIN
  -- 重置断签用户的连续天数
  UPDATE public.profiles
  SET consecutive_checkin_days = 0
  WHERE last_checkin IS NOT NULL
    AND last_checkin < CURRENT_DATE  -- 最后签到日期不是今天
    AND consecutive_checkin_days > 0; -- 且连续天数大于0

  GET DIAGNOSTICS affected_count = ROW_COUNT;

  -- 记录日志
  RAISE NOTICE '已重置 % 位用户的连续签到天数', affected_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION reset_broken_checkin_streaks() IS
'定时任务：每天0点重置断签用户的连续签到天数为0';

-- 配置定时任务
SELECT cron.schedule(
  'reset-checkin-streaks',
  '0 0 * * *',  -- 每天 0点（UTC时间）
  $$SELECT reset_broken_checkin_streaks();$$
);


-- ============================================
-- 3. 押金商家每日登录奖励重置
-- ============================================
-- 功能：重置押金商家的每日登录奖励领取状态
-- 频率：每天凌晨 5点 执行
-- 逻辑：将 last_daily_login_reward_at 设为 NULL，允许商家再次领取

-- 创建重置函数
CREATE OR REPLACE FUNCTION reset_daily_merchant_rewards()
RETURNS void AS $$
DECLARE
  affected_count INTEGER;
BEGIN
  -- 重置押金商家的每日登录奖励状态
  UPDATE public.merchants
  SET last_daily_login_reward_at = NULL
  WHERE is_deposit_merchant = true
    AND deposit_status = 'active'
    AND last_daily_login_reward_at IS NOT NULL
    AND last_daily_login_reward_at < CURRENT_DATE;

  GET DIAGNOSTICS affected_count = ROW_COUNT;

  RAISE NOTICE '已重置 % 个押金商家的每日登录奖励状态', affected_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION reset_daily_merchant_rewards() IS
'定时任务：每天5点重置押金商家的每日登录奖励领取状态';

-- 配置定时任务
SELECT cron.schedule(
  'reset-daily-merchant-rewards',
  '0 5 * * *',  -- 每天 5点（UTC时间）
  $$SELECT reset_daily_merchant_rewards();$$
);


-- ============================================
-- 4. 用户邀请次数月度重置
-- ============================================
-- 功能：每月自动重置用户的邀请次数配额
-- 频率：每月1号凌晨 0点 执行
-- 逻辑：重置 used_invitations 为 0，更新 invitation_reset_month

-- 创建重置函数
CREATE OR REPLACE FUNCTION reset_monthly_invitations()
RETURNS void AS $$
DECLARE
  affected_count INTEGER;
  current_month TEXT;
BEGIN
  -- 获取当前年月（格式：YYYY-MM）
  current_month := TO_CHAR(CURRENT_DATE, 'YYYY-MM');

  -- 重置所有需要重置的用户
  UPDATE public.profiles
  SET
    used_invitations = 0,
    invitation_reset_month = current_month
  WHERE invitation_reset_month IS NULL
     OR invitation_reset_month != current_month;

  GET DIAGNOSTICS affected_count = ROW_COUNT;

  RAISE NOTICE '已重置 % 位用户的月度邀请次数配额', affected_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION reset_monthly_invitations() IS
'定时任务：每月1号0点重置用户的邀请次数配额';

-- 配置定时任务
SELECT cron.schedule(
  'reset-monthly-invitations',
  '0 0 1 * *',  -- 每月1号 0点（UTC时间）
  $$SELECT reset_monthly_invitations();$$
);


-- ============================================
-- 验证与管理命令
-- ============================================

-- 查看所有已配置的定时任务
SELECT
  jobid,
  jobname,
  schedule,
  command,
  active,
  database
FROM cron.job
ORDER BY jobid;

-- 查看最近的执行记录
SELECT
  jobid,
  runid,
  job_pid,
  database,
  username,
  command,
  status,
  return_message,
  start_time,
  end_time
FROM cron.job_run_details
ORDER BY start_time DESC
LIMIT 20;

-- ============================================
-- 如果需要删除任务，使用以下命令：
-- ============================================
-- SELECT cron.unschedule('disable-expired-banners');
-- SELECT cron.unschedule('reset-checkin-streaks');
-- SELECT cron.unschedule('reset-daily-merchant-rewards');
-- SELECT cron.unschedule('reset-monthly-invitations');

-- ============================================
-- 手动测试函数（可选）
-- ============================================
-- SELECT disable_expired_banners();
-- SELECT reset_broken_checkin_streaks();
-- SELECT reset_daily_merchant_rewards();
-- SELECT reset_monthly_invitations();

-- ============================================
-- 时区说明
-- ============================================
-- pg_cron 使用的是 UTC 时区
-- 如果你在中国（UTC+8），需要注意时间转换：
--
-- UTC 0点 = 北京时间 8点
-- UTC 5点 = 北京时间 13点
-- UTC 12点 = 北京时间 20点
-- UTC 16点 = 北京时间 0点（次日）
--
-- 如果需要按北京时间执行，请调整 schedule：
-- 北京时间 0点 = UTC 16点（前一天）
-- 北京时间 5点 = UTC 21点（前一天）
-- 北京时间 12点 = UTC 4点
