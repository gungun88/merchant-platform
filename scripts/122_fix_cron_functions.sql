-- ============================================
-- 修复 Vercel Cron 迁移脚本中的函数
-- ============================================
-- 目的：修复表字段名称不匹配的问题
-- 执行日期：2025-11-24
-- ============================================

-- ============================================
-- 修复任务 1: 置顶商家即将到期提醒（3天内）
-- ============================================

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

    -- 插入通知（修正字段名）
    INSERT INTO public.user_notifications (
      user_id,
      type,
      title,
      content,
      is_read,
      created_at
    ) VALUES (
      merchant_record.user_id,
      'merchant_top_expiring',
      '商家置顶即将到期',
      '您的商家"' || merchant_record.name || '"的置顶服务将在 ' || days_left || ' 天后到期 (' || formatted_date || ')',
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
-- 修复任务 2: 合作伙伴即将到期提醒（7天内）
-- ============================================

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

  -- 查找7天内即将到期的合作伙伴（修正字段名）
  FOR partner_record IN
    SELECT
      p.id,
      p.created_by as user_id,
      p.name,  -- 修正：使用 name 而不是 business_name
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

    -- 插入通知（修正字段名）
    INSERT INTO public.user_notifications (
      user_id,
      type,
      title,
      content,
      is_read,
      created_at
    ) VALUES (
      partner_record.user_id,
      'partner_expiring',
      '合作伙伴订阅即将到期',
      '您的合作伙伴"' || partner_record.name || '"订阅将在 ' || days_left || ' 天后到期 (' || formatted_date || ')',
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
-- 验证修复结果
-- ============================================

-- 手动测试函数
SELECT * FROM check_expiring_top_merchants();
SELECT * FROM check_expiring_partners();

-- 查看函数定义
SELECT
  p.proname AS function_name,
  pg_get_functiondef(p.oid) AS definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname IN ('check_expiring_top_merchants', 'check_expiring_partners')
ORDER BY p.proname;
