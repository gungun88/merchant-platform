-- ============================================
-- 通知过期清理定时任务
-- ============================================
-- 目的：定期清理已读的旧通知，防止表过大影响性能
-- 执行日期：2025-11-24
-- ============================================

-- ============================================
-- 创建清理函数
-- ============================================
-- 功能：删除30天前已读的通知，保留未读通知

DROP FUNCTION IF EXISTS cleanup_old_notifications();

CREATE OR REPLACE FUNCTION cleanup_old_notifications()
RETURNS TABLE(deleted_count INTEGER) AS $$
DECLARE
  count_result INTEGER := 0;
  thirty_days_ago TIMESTAMP;
BEGIN
  -- 计算30天前的时间
  thirty_days_ago := NOW() - INTERVAL '30 days';

  -- 删除30天前已读的通知
  DELETE FROM public.user_notifications
  WHERE is_read = true
    AND created_at < thirty_days_ago;

  -- 获取删除的记录数
  GET DIAGNOSTICS count_result = ROW_COUNT;

  RAISE NOTICE '[通知清理] 已删除 % 条旧通知', count_result;

  RETURN QUERY SELECT count_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION cleanup_old_notifications() IS
'每周任务：删除30天前已读的通知，防止表过大（北京时间每周一凌晨2点执行）';


-- ============================================
-- 配置定时任务（北京时间）
-- ============================================
-- 时区转换说明：
-- 北京时间 周一 2点 = UTC 周日 18点
-- Cron表达式：分 时 日 月 周
-- 周日 = 0, 周一 = 1, ..., 周六 = 6

SELECT cron.schedule(
  'notification-cleanup-beijing-monday-2am',
  '0 18 * * 0',  -- UTC 周日 18点 = 北京时间 周一 2点
  $$SELECT cleanup_old_notifications();$$
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
-- - notification-cleanup-beijing-monday-2am (北京时间每周一2点)


-- ============================================
-- 手动测试函数（可选）
-- ============================================

-- 测试清理函数
-- SELECT * FROM cleanup_old_notifications();

-- 查看当前通知表的统计信息
-- SELECT
--   COUNT(*) as total_notifications,
--   COUNT(CASE WHEN is_read = true THEN 1 END) as read_notifications,
--   COUNT(CASE WHEN is_read = false THEN 1 END) as unread_notifications,
--   COUNT(CASE WHEN is_read = true AND created_at < NOW() - INTERVAL '30 days' THEN 1 END) as old_read_notifications
-- FROM public.user_notifications;


-- ============================================
-- 清理策略说明
-- ============================================
-- 1. 保留条件：
--    - 所有未读通知（无论多久）
--    - 30天内的已读通知
--
-- 2. 删除条件：
--    - 30天前的已读通知
--
-- 3. 执行频率：
--    - 每周一凌晨2点（北京时间）
--    - 避开业务高峰期
--
-- 4. 如果需要调整保留天数：
--    - 修改函数中的 INTERVAL '30 days'
--    - 重新执行本脚本即可


-- ============================================
-- 最终的完整定时任务列表（北京时间）
-- ============================================
-- 北京时间 周一 2点：
--   - 通知过期清理（新任务）
--
-- 北京时间 0点：
--   - Banner 过期禁用（任务5）
--   - 连续签到重置（任务6）
--   - 月度邀请重置（任务8，仅每月1号）
--
-- 北京时间 5点：
--   - 押金商家每日奖励重置（任务7）
--
-- 北京时间 10点：
--   - 置顶商家到期提醒（任务10）
--   - 合作伙伴到期提醒（任务11）
--
-- 北京时间 12点：
--   - Banner 过期禁用（任务5）
--
-- 每小时整点：
--   - 置顶商家过期检查（任务9）


-- ============================================
-- 如果需要删除这个任务
-- ============================================
-- SELECT cron.unschedule('notification-cleanup-beijing-monday-2am');
