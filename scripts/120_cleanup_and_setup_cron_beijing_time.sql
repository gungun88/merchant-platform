-- ============================================
-- 清理旧任务并配置所有定时任务（北京时间）
-- ============================================
-- 执行日期：2025年
-- 时区：所有时间均按北京时间（UTC+8）配置
-- ============================================

-- ============================================
-- 第一步：删除所有旧的定时任务
-- ============================================

-- 删除旧的置顶商家相关任务
SELECT cron.unschedule(1); -- expire_topped_merchants
SELECT cron.unschedule(2); -- expire_top_merchants
SELECT cron.unschedule(3); -- check_expiring_top_merchants
SELECT cron.unschedule(4); -- execute_scheduled_point_transfers

-- 如果有其他任务ID，也可以删除
-- SELECT cron.unschedule(5);
-- SELECT cron.unschedule(6);

-- 验证是否已全部删除
SELECT
  jobid,
  jobname,
  schedule,
  command
FROM cron.job;

-- 应该返回空结果，如果还有残留，继续删除


-- ============================================
-- 第二步：创建所有必需的数据库函数
-- ============================================

-- --------------------------------------------
-- 函数 1: Banner 过期自动禁用
-- --------------------------------------------
-- 依赖：banners 表已有 expires_at 字段
-- 可能已在 scripts/089 中创建，这里确保函数存在

DROP FUNCTION IF EXISTS disable_expired_banners();

CREATE OR REPLACE FUNCTION disable_expired_banners()
RETURNS void AS $$
BEGIN
  UPDATE public.banners
  SET is_active = false
  WHERE expires_at IS NOT NULL
    AND expires_at <= NOW()
    AND is_active = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION disable_expired_banners() IS
'定时任务：每天0点和12点自动禁用已过期的广告Banner';

-- --------------------------------------------
-- 函数 2: 连续签到天数重置
-- --------------------------------------------
DROP FUNCTION IF EXISTS reset_broken_checkin_streaks();

CREATE OR REPLACE FUNCTION reset_broken_checkin_streaks()
RETURNS TABLE(affected_count INTEGER) AS $$
DECLARE
  count_result INTEGER;
BEGIN
  -- 重置断签用户的连续天数为 0
  UPDATE public.profiles
  SET consecutive_checkin_days = 0
  WHERE last_checkin IS NOT NULL
    AND last_checkin < CURRENT_DATE  -- 不是今天签到的
    AND consecutive_checkin_days > 0; -- 且有连续记录

  GET DIAGNOSTICS count_result = ROW_COUNT;

  RAISE NOTICE '[签到重置] 已重置 % 位用户的连续签到天数', count_result;

  RETURN QUERY SELECT count_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION reset_broken_checkin_streaks() IS
'每日任务：重置断签用户的连续签到天数（北京时间每天0点执行）';

-- --------------------------------------------
-- 函数 3: 押金商家每日登录奖励重置
-- --------------------------------------------
DROP FUNCTION IF EXISTS reset_daily_merchant_rewards();

CREATE OR REPLACE FUNCTION reset_daily_merchant_rewards()
RETURNS TABLE(affected_count INTEGER) AS $$
DECLARE
  count_result INTEGER;
BEGIN
  -- 重置押金商家的每日登录奖励状态
  UPDATE public.merchants
  SET last_daily_login_reward_at = NULL
  WHERE is_deposit_merchant = true
    AND deposit_status = 'active'
    AND last_daily_login_reward_at IS NOT NULL
    AND last_daily_login_reward_at < CURRENT_DATE;

  GET DIAGNOSTICS count_result = ROW_COUNT;

  RAISE NOTICE '[每日奖励重置] 已重置 % 个押金商家的登录奖励状态', count_result;

  RETURN QUERY SELECT count_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION reset_daily_merchant_rewards() IS
'每日任务：重置押金商家的每日登录奖励（北京时间每天5点执行）';

-- --------------------------------------------
-- 函数 4: 月度邀请次数重置
-- --------------------------------------------
DROP FUNCTION IF EXISTS reset_monthly_invitations();

CREATE OR REPLACE FUNCTION reset_monthly_invitations()
RETURNS TABLE(affected_count INTEGER) AS $$
DECLARE
  count_result INTEGER;
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

  GET DIAGNOSTICS count_result = ROW_COUNT;

  RAISE NOTICE '[邀请次数重置] 已重置 % 位用户的月度邀请配额', count_result;

  RETURN QUERY SELECT count_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION reset_monthly_invitations() IS
'月度任务：重置用户邀请次数配额（北京时间每月1号0点执行）';

-- --------------------------------------------
-- 函数 5: 置顶商家过期下架（保留原有逻辑）
-- --------------------------------------------
-- 注意：这个函数可能已经存在，需要先删除旧版本
DROP FUNCTION IF EXISTS expire_top_merchants();

CREATE OR REPLACE FUNCTION expire_top_merchants()
RETURNS TABLE(expired_count INTEGER) AS $$
DECLARE
  count_result INTEGER;
BEGIN
  -- 下架已过期的置顶商家
  UPDATE public.merchants
  SET is_topped = false
  WHERE is_topped = true
    AND topped_until IS NOT NULL
    AND topped_until <= NOW();

  GET DIAGNOSTICS count_result = ROW_COUNT;

  RAISE NOTICE '[置顶过期] 已下架 % 个过期的置顶商家', count_result;

  RETURN QUERY SELECT count_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION expire_top_merchants() IS
'每小时任务：自动下架已过期的置顶商家';

-- --------------------------------------------
-- 函数 6: 定时积分转账执行
-- --------------------------------------------
-- 保留原有的定时积分转账功能
-- 如果 execute_scheduled_point_transfers 函数不存在，需要先创建


-- ============================================
-- 第三步：配置所有定时任务（北京时间）
-- ============================================
-- 时区转换说明：
-- pg_cron 使用 UTC 时区，北京时间 = UTC + 8小时
-- 因此：北京时间 X点 = UTC (X-8)点
--
-- 北京时间 0点 = UTC 16点（前一天）
-- 北京时间 5点 = UTC 21点（前一天）
-- 北京时间 8点 = UTC 0点
-- 北京时间 9点 = UTC 1点
-- 北京时间 12点 = UTC 4点
-- ============================================

-- --------------------------------------------
-- 任务 1: Banner 过期禁用
-- 执行时间：北京时间每天 0点 和 12点
-- 对应 UTC：16点（前一天）和 4点
-- --------------------------------------------
SELECT cron.schedule(
  'banner-expire-beijing-0am-12pm',
  '0 16,4 * * *',  -- UTC 16点和4点 = 北京时间 0点和12点
  $$SELECT disable_expired_banners();$$
);

-- --------------------------------------------
-- 任务 2: 连续签到重置
-- 执行时间：北京时间每天 0点
-- 对应 UTC：16点（前一天）
-- --------------------------------------------
SELECT cron.schedule(
  'checkin-reset-beijing-0am',
  '0 16 * * *',  -- UTC 16点 = 北京时间 0点
  $$SELECT reset_broken_checkin_streaks();$$
);

-- --------------------------------------------
-- 任务 3: 每日登录奖励重置
-- 执行时间：北京时间每天 5点
-- 对应 UTC：21点（前一天）
-- --------------------------------------------
SELECT cron.schedule(
  'daily-reward-reset-beijing-5am',
  '0 21 * * *',  -- UTC 21点 = 北京时间 5点
  $$SELECT reset_daily_merchant_rewards();$$
);

-- --------------------------------------------
-- 任务 4: 月度邀请重置
-- 执行时间：北京时间每月1号 0点
-- 对应 UTC：前一月最后一天 16点
-- --------------------------------------------
SELECT cron.schedule(
  'invitation-reset-beijing-monthly',
  '0 16 1 * *',  -- 每月1号 UTC 16点 = 北京时间每月1号 0点
  $$SELECT reset_monthly_invitations();$$
);

-- --------------------------------------------
-- 任务 5: 置顶商家过期检查
-- 执行时间：北京时间每小时整点
-- 对应 UTC：每小时整点（北京时间比UTC快8小时，所以同样每小时执行）
-- --------------------------------------------
SELECT cron.schedule(
  'topped-expire-hourly',
  '0 * * * *',  -- 每小时执行（UTC和北京时间都是每小时）
  $$SELECT expire_top_merchants();$$
);

-- --------------------------------------------
-- 任务 6: 定时积分转账（如果需要，请单独执行）
-- 执行时间：每5分钟
-- --------------------------------------------
-- 注意: 由于 pg_cron 某些版本不支持 */5 语法，
-- 如需启用此功能，请单独执行以下命令：
--
-- SELECT cron.schedule(
--   'scheduled-point-transfers',
--   '0,5,10,15,20,25,30,35,40,45,50,55 * * * *',
--   $$SELECT execute_scheduled_point_transfers();$$
-- );


-- ============================================
-- 第四步：验证配置结果
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

-- 应该看到以下任务：
-- 1. banner-expire-beijing-0am-12pm  (北京时间0点和12点)
-- 2. checkin-reset-beijing-0am       (北京时间0点)
-- 3. daily-reward-reset-beijing-5am  (北京时间5点)
-- 4. invitation-reset-beijing-monthly (北京时间每月1号0点)
-- 5. topped-expire-hourly            (每小时)


-- ============================================
-- 第五步：手动测试所有函数（可选）
-- ============================================

-- 测试 Banner 过期禁用
-- SELECT disable_expired_banners();

-- 测试签到重置
-- SELECT * FROM reset_broken_checkin_streaks();

-- 测试每日奖励重置
-- SELECT * FROM reset_daily_merchant_rewards();

-- 测试邀请次数重置
-- SELECT * FROM reset_monthly_invitations();

-- 测试置顶商家过期
-- SELECT * FROM expire_top_merchants();


-- ============================================
-- 第六步：查看执行历史（过几分钟后执行）
-- ============================================

-- 查看最近20条执行记录
SELECT
  jobid,
  runid,
  job_pid,
  database,
  command,
  status,
  return_message,
  start_time,
  end_time,
  (end_time - start_time) as duration
FROM cron.job_run_details
ORDER BY start_time DESC
LIMIT 20;


-- ============================================
-- 管理命令（备用）
-- ============================================

-- 如果需要删除某个任务：
-- SELECT cron.unschedule('任务名称');

-- 如果需要暂停某个任务：
-- UPDATE cron.job SET active = false WHERE jobname = '任务名称';

-- 如果需要恢复某个任务：
-- UPDATE cron.job SET active = true WHERE jobname = '任务名称';


-- ============================================
-- 完整的定时任务时间表（北京时间）
-- ============================================
/*
北京时间 0点：
  - Banner 过期禁用（每天2次之一）
  - 连续签到重置
  - 月度邀请重置（每月1号）

北京时间 5点：
  - 押金商家每日奖励重置

北京时间 12点：
  - Banner 过期禁用（每天2次之二）

每小时整点：
  - 置顶商家过期检查

每5分钟（如果启用）：
  - 定时积分转账执行
*/

-- ============================================
-- 注意事项
-- ============================================
/*
1. 所有任务均按北京时间配置（UTC+8）
2. pg_cron 在 Supabase 免费计划中可用
3. 函数执行失败会记录在 cron.job_run_details 中
4. 建议每周检查一次执行历史，确保任务正常运行
5. 如需修改执行时间，请先 unschedule 再重新 schedule

6. Vercel Cron 任务（独立管理，不在此脚本中）：
   - /api/cron/expire-tops (每小时)
   - /api/cron/check-expiring (每天10点)
   - /api/cron/check-expiring-partners (每天0点)

   建议：将这些也迁移到 pg_cron，可以节省 Vercel Cron 配额
*/
