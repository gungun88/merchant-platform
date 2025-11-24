-- ============================================
-- 迁移 Vercel Cron 任务到 pg_cron
-- ============================================
-- 目的：将原本在 Vercel 中运行的定时任务迁移到 Supabase pg_cron
-- 执行日期：2025年
-- ============================================

-- ============================================
-- 分析与说明
-- ============================================
-- 原 Vercel Cron 任务：
-- 1. /api/cron/expire-tops (每小时)
--    - 功能：下架过期的置顶商家
--    - 状态：✅ 已迁移！对应任务9: topped-expire-hourly
--    - 无需额外操作
--
-- 2. /api/cron/check-expiring (每天10点)
--    - 功能：检查3天内即将到期的置顶商家，发送通知
--    - 状态：需要创建数据库函数
--
-- 3. /api/cron/check-expiring-partners (每天0点)
--    - 功能：检查7天内即将到期的合作伙伴，发送通知
--    - 状态：需要创建数据库函数

-- ============================================
-- 任务 1: 置顶商家即将到期提醒（已迁移✅）
-- ============================================
-- 对应的 Vercel 任务已经被 topped-expire-hourly 替代
-- 无需额外操作


-- ============================================
-- 任务 2: 置顶商家即将到期提醒（3天内）
-- ============================================
-- 创建函数：检查并通知3天内即将到期的置顶商家

DROP FUNCTION IF EXISTS check_expiring_top_merchants();

CREATE OR REPLACE FUNCTION check_expiring_top_merchants()
RETURNS TABLE(notification_count INTEGER) AS $$
DECLARE
  merchant_record RECORD;
  count_result INTEGER := 0;
  three_days_later TIMESTAMP;
  days_left INTEGER;
  formatted_date TEXT;
BEGIN
  -- 计算3天后的时间
  three_days_later := NOW() + INTERVAL '3 days';

  -- 查找3天内即将到期的置顶商家
  FOR merchant_record IN
    SELECT
      m.id,
      m.user_id,
      m.name,
      m.topped_until
    FROM public.merchants m
    WHERE m.is_topped = true
      AND m.topped_until IS NOT NULL
      AND m.topped_until > NOW()  -- 还没过期
      AND m.topped_until <= three_days_later  -- 3天内到期
  LOOP
    -- 计算剩余天数
    days_left := CEIL(EXTRACT(EPOCH FROM (merchant_record.topped_until - NOW())) / 86400);

    -- 格式化日期为 YYYY/MM/DD
    formatted_date := TO_CHAR(merchant_record.topped_until, 'YYYY/MM/DD');

    -- 插入通知
    INSERT INTO public.user_notifications (
      user_id,
      type,
      category,
      title,
      content,
      related_merchant_id,
      priority,
      metadata,
      read,
      created_at
    ) VALUES (
      merchant_record.user_id,
      'merchant',
      'merchant_top_expiring',
      '商家置顶即将到期',
      '您的商家"' || merchant_record.name || '"的置顶服务将在 ' || days_left || ' 天后到期 (' || formatted_date || ')',
      merchant_record.id,
      'high',
      jsonb_build_object(
        'expires_at', merchant_record.topped_until,
        'days_left', days_left
      ),
      false,
      NOW()
    );

    count_result := count_result + 1;
  END LOOP;

  RAISE NOTICE '[置顶到期提醒] 已发送 % 条通知', count_result;

  RETURN QUERY SELECT count_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION check_expiring_top_merchants() IS
'每日任务：检查3天内即将到期的置顶商家并发送通知（北京时间每天10点执行）';


-- ============================================
-- 任务 3: 合作伙伴即将到期提醒（7天内）
-- ============================================
-- 创建函数：检查并通知7天内即将到期的合作伙伴

DROP FUNCTION IF EXISTS check_expiring_partners();

CREATE OR REPLACE FUNCTION check_expiring_partners()
RETURNS TABLE(notification_count INTEGER) AS $$
DECLARE
  partner_record RECORD;
  count_result INTEGER := 0;
  seven_days_later TIMESTAMP;
  days_left INTEGER;
  formatted_date TEXT;
BEGIN
  -- 计算7天后的时间
  seven_days_later := NOW() + INTERVAL '7 days';

  -- 查找7天内即将到期的合作伙伴
  FOR partner_record IN
    SELECT
      p.id,
      p.created_by as user_id,
      p.business_name as name,
      p.expires_at
    FROM public.partners p
    WHERE p.status = 'approved'
      AND p.expires_at IS NOT NULL
      AND p.expires_at >= NOW()  -- 还没过期
      AND p.expires_at <= seven_days_later  -- 7天内到期
  LOOP
    -- 计算剩余天数
    days_left := CEIL(EXTRACT(EPOCH FROM (partner_record.expires_at - NOW())) / 86400);

    -- 格式化日期为 YYYY/MM/DD
    formatted_date := TO_CHAR(partner_record.expires_at, 'YYYY/MM/DD');

    -- 插入通知
    INSERT INTO public.user_notifications (
      user_id,
      type,
      category,
      title,
      content,
      priority,
      metadata,
      read,
      created_at
    ) VALUES (
      partner_record.user_id,
      'partner',
      'partner_expiring',
      '合作伙伴订阅即将到期',
      '您的合作伙伴"' || partner_record.name || '"订阅将在 ' || days_left || ' 天后到期 (' || formatted_date || ')',
      'high',
      jsonb_build_object(
        'expires_at', partner_record.expires_at,
        'days_left', days_left,
        'partner_id', partner_record.id
      ),
      false,
      NOW()
    );

    count_result := count_result + 1;
  END LOOP;

  RAISE NOTICE '[合作伙伴到期提醒] 已发送 % 条通知', count_result;

  RETURN QUERY SELECT count_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION check_expiring_partners() IS
'每日任务：检查7天内即将到期的合作伙伴并发送通知（北京时间每天10点执行）';


-- ============================================
-- 配置定时任务（北京时间）
-- ============================================
-- 时区转换说明：
-- 北京时间 10点 = UTC 2点

-- --------------------------------------------
-- 任务 A: 置顶商家到期提醒
-- 执行时间：北京时间每天 10点
-- 对应 UTC：2点
-- --------------------------------------------
SELECT cron.schedule(
  'topped-expiring-check-beijing-10am',
  '0 2 * * *',  -- UTC 2点 = 北京时间 10点
  $$SELECT check_expiring_top_merchants();$$
);

-- --------------------------------------------
-- 任务 B: 合作伙伴到期提醒
-- 执行时间：北京时间每天 10点
-- 对应 UTC：2点
-- --------------------------------------------
SELECT cron.schedule(
  'partner-expiring-check-beijing-10am',
  '0 2 * * *',  -- UTC 2点 = 北京时间 10点
  $$SELECT check_expiring_partners();$$
);


-- ============================================
-- 验证配置结果
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

-- 应该看到以下新任务：
-- - topped-expiring-check-beijing-10am  (北京时间10点)
-- - partner-expiring-check-beijing-10am (北京时间10点)


-- ============================================
-- 手动测试函数（可选）
-- ============================================

-- 测试置顶商家到期提醒
-- SELECT * FROM check_expiring_top_merchants();

-- 测试合作伙伴到期提醒
-- SELECT * FROM check_expiring_partners();


-- ============================================
-- 最终的完整定时任务列表（北京时间）
-- ============================================
-- 北京时间 0点：
--   - Banner 过期禁用（任务5）
--   - 连续签到重置（任务6）
--   - 月度邀请重置（任务8，仅每月1号）
--
-- 北京时间 5点：
--   - 押金商家每日奖励重置（任务7）
--
-- 北京时间 10点：
--   - 置顶商家到期提醒（新任务A）
--   - 合作伙伴到期提醒（新任务B）
--
-- 北京时间 12点：
--   - Banner 过期禁用（任务5）
--
-- 每小时整点：
--   - 置顶商家过期检查（任务9）


-- ============================================
-- 清理说明
-- ============================================
-- 执行此脚本后，可以删除或保留以下文件：
-- 1. vercel.json - 可以删除 crons 配置项
-- 2. app/api/cron/* - 可以保留作为备用，也可以删除
--
-- 如果要完全删除 Vercel Cron 配置，修改 vercel.json：
-- {
--   "crons": []
-- }
--
-- 或者直接删除 crons 配置项。


-- ============================================
-- 如果需要删除这些新任务
-- ============================================
-- SELECT cron.unschedule('topped-expiring-check-beijing-10am');
-- SELECT cron.unschedule('partner-expiring-check-beijing-10am');
