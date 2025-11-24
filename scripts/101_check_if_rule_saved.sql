-- 检查规则是否已经保存成功

-- 1. 查询 group_reward_rules 表
SELECT
  id,
  group_id,
  coins_amount,
  reward_type,
  custom_day_of_month,
  custom_day_of_week,
  next_reward_date,
  is_active,
  created_at,
  updated_at
FROM public.group_reward_rules
WHERE group_id = '1ad7c993-0dbd-4e35-881d-6ad2aad7f092';

-- 2. 如果上面有结果,再检查成员数量
SELECT COUNT(*) as member_count
FROM public.user_group_members
WHERE group_id = '1ad7c993-0dbd-4e35-881d-6ad2aad7f092';

-- 3. 检查刚才的发放日志
SELECT
  l.*,
  p.email,
  p.username
FROM public.group_reward_logs l
LEFT JOIN public.profiles p ON p.id = l.user_id
WHERE l.group_id = '1ad7c993-0dbd-4e35-881d-6ad2aad7f092'
ORDER BY l.executed_at DESC
LIMIT 10;
