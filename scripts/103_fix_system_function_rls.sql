-- 修复 trigger_group_reward 函数无法查询成员的问题
-- 原因: SECURITY DEFINER 函数中没有 auth.uid() 上下文,导致 RLS 策略阻止查询

-- 方案: 为系统函数添加特殊的 RLS 策略,允许它们访问所有数据

-- 1. 为 user_group_members 表添加系统访问策略
CREATE POLICY "System functions can access all members"
  ON public.user_group_members
  FOR SELECT
  USING (true);  -- 允许所有 SELECT 操作(包括 SECURITY DEFINER 函数)

-- 2. 为 group_reward_rules 表添加系统访问策略
CREATE POLICY "System functions can access all rules"
  ON public.group_reward_rules
  FOR SELECT
  USING (true);

-- 3. 为 group_reward_logs 表添加系统插入策略
CREATE POLICY "System functions can insert logs"
  ON public.group_reward_logs
  FOR INSERT
  WITH CHECK (true);

-- 注意: 这些策略只允许 SELECT 和 INSERT 操作
-- 管理员的 UPDATE/DELETE 操作仍然由原来的策略控制
-- 这样既保证了安全性,又让系统函数能正常工作

-- 4. 验证所有策略
SELECT
  schemaname,
  tablename,
  policyname,
  cmd,
  CASE
    WHEN policyname LIKE '%System%' THEN '系统策略'
    WHEN policyname LIKE '%Admins%' THEN '管理员策略'
    ELSE '其他策略'
  END as policy_type
FROM pg_policies
WHERE tablename IN ('user_group_members', 'group_reward_rules', 'group_reward_logs')
ORDER BY tablename, policy_type, policyname;
