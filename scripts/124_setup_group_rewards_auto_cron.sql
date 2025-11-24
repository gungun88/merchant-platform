-- ============================================
-- 用户组积分自动发放定时任务
-- ============================================
-- 目的：配置定时任务，自动处理用户组的积分发放
-- 执行日期：2025-11-24
-- ============================================

-- ============================================
-- 说明
-- ============================================
-- 功能：根据用户组的发放规则（daily/weekly/monthly/custom），
--       自动在到期日给组内所有成员发放积分
--
-- 依赖：
-- - process_group_rewards() 函数已存在（创建于 scripts/090）
-- - group_reward_rules 表中配置了发放规则
-- - 规则的 is_active = true 且 next_reward_date <= 当前日期
--
-- 执行逻辑：
-- 1. 每天早上9点（北京时间）检查所有到期的发放规则
-- 2. 为符合条件的用户组成员发放积分
-- 3. 自动更新下次发放日期
-- 4. 创建通知和交易记录

-- ============================================
-- 配置定时任务（北京时间）
-- ============================================
-- 时区转换说明：
-- 北京时间 早上9点 = UTC 凌晨1点

SELECT cron.schedule(
  'group-rewards-auto-beijing-9am',
  '0 1 * * *',  -- UTC 1点 = 北京时间 9点
  $$SELECT process_group_rewards();$$
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
-- - group-rewards-auto-beijing-9am (北京时间每天早上9点)


-- ============================================
-- 手动测试函数（可选）
-- ============================================

-- 测试自动发放函数
-- SELECT * FROM process_group_rewards();
-- 返回: processed_count, failed_count, details

-- 测试手动发放特定用户组
-- SELECT * FROM trigger_group_reward('your-group-id-here');

-- 查看发放日志
-- SELECT
--   l.*,
--   g.name as group_name,
--   p.email as user_email
-- FROM group_reward_logs l
-- JOIN user_groups g ON g.id = l.group_id
-- JOIN profiles p ON p.id = l.user_id
-- ORDER BY l.executed_at DESC
-- LIMIT 20;

-- 查看当前待发放的规则
-- SELECT
--   g.name as group_name,
--   r.reward_type,
--   r.coins_amount,
--   r.next_reward_date,
--   r.is_active,
--   (SELECT COUNT(*) FROM user_group_members WHERE group_id = g.id) as member_count
-- FROM group_reward_rules r
-- JOIN user_groups g ON g.id = r.group_id
-- WHERE r.is_active = true
-- ORDER BY r.next_reward_date;


-- ============================================
-- 发放规则说明
-- ============================================
-- 1. 发放类型：
--    - daily: 每天发放
--    - weekly: 每周发放（可指定星期几）
--    - monthly: 每月发放（可指定日期）
--    - custom: 自定义周期
--
-- 2. 发放时间：
--    - 每天北京时间早上9点检查
--    - 如果 next_reward_date <= 今天，则自动发放
--
-- 3. 防重复机制：
--    - 检查 group_reward_logs 表，避免同一天重复发放
--
-- 4. 自动更新：
--    - 发放完成后，自动计算并更新 next_reward_date


-- ============================================
-- 最终的完整定时任务列表（北京时间）
-- ============================================
-- 北京时间 周一 2点：
--   - 通知过期清理（任务12）
--
-- 北京时间 0点：
--   - Banner 过期禁用（任务5）
--   - 连续签到重置（任务6）
--   - 月度邀请重置（任务8，仅每月1号）
--
-- 北京时间 5点：
--   - 押金商家每日奖励重置（任务7）
--
-- 北京时间 9点：
--   - 用户组积分自动发放（新任务）⭐ 新增
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
-- 常用管理命令
-- ============================================

-- 暂停自动发放
-- UPDATE cron.job SET active = false WHERE jobname = 'group-rewards-auto-beijing-9am';

-- 恢复自动发放
-- UPDATE cron.job SET active = true WHERE jobname = 'group-rewards-auto-beijing-9am';

-- 删除任务
-- SELECT cron.unschedule('group-rewards-auto-beijing-9am');

-- 查看最近的执行记录
-- SELECT
--   j.jobname,
--   d.status,
--   d.return_message,
--   d.start_time AT TIME ZONE 'Asia/Shanghai' as beijing_time
-- FROM cron.job_run_details d
-- JOIN cron.job j ON j.jobid = d.jobid
-- WHERE j.jobname = 'group-rewards-auto-beijing-9am'
-- ORDER BY d.start_time DESC
-- LIMIT 10;


-- ============================================
-- 使用场景示例
-- ============================================
/*
场景1: 每日签到奖励
- 创建用户组 "每日活跃用户"
- 设置发放规则: daily, 10积分
- 系统每天9点自动发放

场景2: 每周任务奖励
- 创建用户组 "周任务完成者"
- 设置发放规则: weekly (每周一), 50积分
- 系统每周一9点自动发放

场景3: 月度VIP奖励
- 创建用户组 "VIP会员"
- 设置发放规则: monthly (每月1号), 200积分
- 系统每月1号9点自动发放

场景4: 手动发放
- 管理员在后台点击"立即发放"按钮
- 调用 trigger_group_reward(group_id)
- 立即给该组所有成员发放积分
*/


-- ============================================
-- 注意事项
-- ============================================
-- 1. 确保 group_reward_rules 表中的规则已正确配置
-- 2. is_active 必须为 true 才会自动发放
-- 3. next_reward_date 必须 <= 当前日期才会触发
-- 4. 发放完成后会自动更新 next_reward_date
-- 5. 每次发放都会创建通知和交易记录
-- 6. 如果发放失败，不会影响其他用户的发放
