-- 确认当前 group_reward_rules 表的所有 RLS 策略

SELECT
  schemaname,
  tablename,
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'group_reward_rules'
ORDER BY cmd, policyname;

-- 测试是否能插入数据(这会实际插入,所以先查询再决定是否执行)
-- 如果上面显示有 "Admins can modify rules" 策略,说明需要管理员权限
-- 而前端通过 createOrUpdateRewardRule 调用时,使用的是用户的 session

-- 检查当前执行 SQL 的用户是否有管理员权限
SELECT
  id,
  email,
  role
FROM public.profiles
WHERE id = auth.uid();
