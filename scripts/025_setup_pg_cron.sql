-- =====================================================
-- 设置 pg_cron 定时任务 - 商家置顶到期提醒系统
-- =====================================================

-- 1. 启用 pg_cron 扩展
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2. 创建检查即将到期置顶商家的函数
CREATE OR REPLACE FUNCTION check_expiring_top_merchants()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  merchant_record RECORD;
  days_left INTEGER;
  expiry_date TIMESTAMP WITH TIME ZONE;
  notification_id UUID;
BEGIN
  -- 查找3天内即将到期的置顶商家
  FOR merchant_record IN
    SELECT
      m.id,
      m.user_id,
      m.name,
      m.topped_until
    FROM merchants m
    WHERE m.is_topped = TRUE
      AND m.topped_until IS NOT NULL
      AND m.topped_until > NOW()  -- 还没过期
      AND m.topped_until <= NOW() + INTERVAL '3 days'  -- 3天内到期
  LOOP
    -- 计算剩余天数
    expiry_date := merchant_record.topped_until;
    days_left := CEIL(EXTRACT(EPOCH FROM (expiry_date - NOW())) / 86400);

    -- 检查是否已经发送过此通知(避免重复)
    -- 检查最近3天内是否有相同的通知
    IF NOT EXISTS (
      SELECT 1 FROM notifications
      WHERE user_id = merchant_record.user_id
        AND category = 'merchant_top_expiring'
        AND related_merchant_id = merchant_record.id
        AND created_at > NOW() - INTERVAL '3 days'
    ) THEN
      -- 创建到期提醒通知
      INSERT INTO notifications (
        user_id,
        type,
        category,
        title,
        content,
        related_merchant_id,
        metadata,
        priority
      ) VALUES (
        merchant_record.user_id,
        'merchant',
        'merchant_top_expiring',
        '商家置顶即将到期',
        '您的商家"' || merchant_record.name || '"的置顶服务将在 ' || days_left || ' 天后到期 (' || TO_CHAR(expiry_date, 'YYYY-MM-DD') || ')',
        merchant_record.id,
        jsonb_build_object(
          'expires_at', expiry_date,
          'days_left', days_left
        ),
        'high'
      );

      RAISE NOTICE '已发送到期提醒通知: 商家 % (剩余 % 天)', merchant_record.name, days_left;
    END IF;
  END LOOP;

  RAISE NOTICE '检查到期提醒任务完成';
END;
$$;

-- 添加函数注释
COMMENT ON FUNCTION check_expiring_top_merchants() IS '检查并发送即将到期(3天内)的置顶商家提醒通知';


-- 3. 创建自动下架过期置顶商家的函数
CREATE OR REPLACE FUNCTION expire_top_merchants()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  merchant_record RECORD;
  expired_count INTEGER := 0;
BEGIN
  -- 查找并更新已过期的置顶商家
  FOR merchant_record IN
    SELECT
      m.id,
      m.user_id,
      m.name
    FROM merchants m
    WHERE m.is_topped = TRUE
      AND m.topped_until IS NOT NULL
      AND m.topped_until < NOW()  -- 已过期
  LOOP
    -- 取消置顶状态
    UPDATE merchants
    SET
      is_topped = FALSE,
      topped_until = NULL
    WHERE id = merchant_record.id;

    -- 发送过期通知
    INSERT INTO notifications (
      user_id,
      type,
      category,
      title,
      content,
      related_merchant_id,
      priority
    ) VALUES (
      merchant_record.user_id,
      'merchant',
      'merchant_top_expired',
      '商家置顶已到期',
      '您的商家"' || merchant_record.name || '"的置顶服务已到期',
      merchant_record.id,
      'normal'
    );

    expired_count := expired_count + 1;
    RAISE NOTICE '已下架过期商家: %', merchant_record.name;
  END LOOP;

  RAISE NOTICE '自动下架任务完成,共处理 % 个商家', expired_count;
END;
$$;

-- 添加函数注释
COMMENT ON FUNCTION expire_top_merchants() IS '自动下架已过期的置顶商家并发送通知';


-- 4. 设置 pg_cron 定时任务
-- 注意: pg_cron 使用的是UTC时间,需要根据您的时区调整

-- 任务1: 每小时检查并下架过期的置顶商家
SELECT cron.schedule(
  'expire-top-merchants',           -- 任务名称
  '0 * * * *',                      -- Cron表达式: 每小时的第0分钟
  $$SELECT expire_top_merchants()$$ -- 要执行的SQL
);

-- 任务2: 每天上午10点(UTC时间凌晨2点 = 北京时间上午10点)检查即将到期的商家
SELECT cron.schedule(
  'check-expiring-top-merchants',           -- 任务名称
  '0 2 * * *',                              -- Cron表达式: 每天UTC时间2:00 (北京时间10:00)
  $$SELECT check_expiring_top_merchants()$$ -- 要执行的SQL
);

-- 5. 查看已创建的定时任务
-- SELECT * FROM cron.job;

-- 6. 如果需要删除任务,使用以下命令:
-- SELECT cron.unschedule('expire-top-merchants');
-- SELECT cron.unschedule('check-expiring-top-merchants');

-- =====================================================
-- 使用说明:
--
-- 1. 在 Supabase SQL Editor 中执行此脚本
-- 2. 定时任务会自动运行:
--    - 每小时检查并下架过期商家
--    - 每天上午10点(北京时间)发送到期提醒
-- 3. 可以手动测试函数:
--    SELECT check_expiring_top_merchants();
--    SELECT expire_top_merchants();
-- 4. 查看定时任务状态:
--    SELECT * FROM cron.job;
-- 5. 查看任务执行历史:
--    SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;
-- =====================================================
