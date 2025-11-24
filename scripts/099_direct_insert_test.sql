-- 直接测试插入数据到 group_reward_rules 表
-- 这将帮助我们确认是否是 RLS 策略的问题

-- 测试1: 直接插入一条记录
INSERT INTO public.group_reward_rules (
  group_id,
  coins_amount,
  reward_type,
  custom_day_of_month,
  next_reward_date,
  is_active
) VALUES (
  '1ad7c993-0dbd-4e35-881d-6ad2aad7f092',
  100,
  'monthly',
  1,
  '2025-12-01',
  true
);

-- 测试2: 查询刚插入的记录
SELECT * FROM public.group_reward_rules
WHERE group_id = '1ad7c993-0dbd-4e35-881d-6ad2aad7f092';

-- 测试3: 如果上面的插入成功,我们尝试删除它
-- DELETE FROM public.group_reward_rules
-- WHERE group_id = '1ad7c993-0dbd-4e35-881d-6ad2aad7f092';
