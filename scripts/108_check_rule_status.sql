-- 检查规则的实际状态

-- 1. 查询该组的所有规则(不管是否启用)
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

-- 2. 如果上面有结果,检查 is_active 的数据类型和值
SELECT
  id,
  is_active,
  pg_typeof(is_active) as is_active_type,
  CASE WHEN is_active = true THEN '是' ELSE '否' END as is_active_text
FROM public.group_reward_rules
WHERE group_id = '1ad7c993-0dbd-4e35-881d-6ad2aad7f092';

-- 3. 尝试用不同的条件查询
SELECT COUNT(*) as total_rules FROM public.group_reward_rules WHERE group_id = '1ad7c993-0dbd-4e35-881d-6ad2aad7f092';
SELECT COUNT(*) as active_rules FROM public.group_reward_rules WHERE group_id = '1ad7c993-0dbd-4e35-881d-6ad2aad7f092' AND is_active = true;
SELECT COUNT(*) as inactive_rules FROM public.group_reward_rules WHERE group_id = '1ad7c993-0dbd-4e35-881d-6ad2aad7f092' AND is_active = false;
SELECT COUNT(*) as null_active FROM public.group_reward_rules WHERE group_id = '1ad7c993-0dbd-4e35-881d-6ad2aad7f092' AND is_active IS NULL;
