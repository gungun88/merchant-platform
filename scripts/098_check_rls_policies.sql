-- 检查 group_reward_rules 表的 RLS 策略

-- 1. 检查表是否启用了 RLS
SELECT
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE tablename = 'group_reward_rules';

-- 2. 检查所有策略
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'group_reward_rules';

-- 3. 测试插入权限(这会显示详细的权限检查)
-- 注意：这只是查看权限,不会真正插入数据
EXPLAIN (VERBOSE, COSTS OFF)
INSERT INTO public.group_reward_rules (
  group_id,
  coins_amount,
  reward_type,
  next_reward_date,
  is_active
) VALUES (
  '1ad7c993-0dbd-4e35-881d-6ad2aad7f092',
  100,
  'monthly',
  '2025-12-01',
  true
);
