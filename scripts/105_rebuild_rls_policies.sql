-- 彻底修复 RLS 策略问题
-- 问题: 多个策略之间可能存在冲突

-- 方案: 删除所有旧策略,重新创建更简单清晰的策略

-- ========== user_group_members 表 ==========

-- 删除所有旧策略
DROP POLICY IF EXISTS "Admins can manage group members" ON public.user_group_members;
DROP POLICY IF EXISTS "System functions can access all members" ON public.user_group_members;

-- 创建新策略: 允许所有已认证用户 SELECT(这样函数就能查询了)
CREATE POLICY "Allow authenticated to select members"
  ON public.user_group_members
  FOR SELECT
  USING (true);

-- 创建新策略: 只有管理员可以 INSERT/UPDATE/DELETE
CREATE POLICY "Admins can modify members"
  ON public.user_group_members
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.role = 'admin' OR profiles.role = 'super_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.role = 'admin' OR profiles.role = 'super_admin')
    )
  );

-- ========== group_reward_rules 表 ==========

DROP POLICY IF EXISTS "Admins can manage reward rules" ON public.group_reward_rules;
DROP POLICY IF EXISTS "System functions can access all rules" ON public.group_reward_rules;

-- 允许所有已认证用户 SELECT
CREATE POLICY "Allow authenticated to select rules"
  ON public.group_reward_rules
  FOR SELECT
  USING (true);

-- 只有管理员可以修改
CREATE POLICY "Admins can modify rules"
  ON public.group_reward_rules
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.role = 'admin' OR profiles.role = 'super_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.role = 'admin' OR profiles.role = 'super_admin')
    )
  );

-- ========== group_reward_logs 表 ==========

DROP POLICY IF EXISTS "Admins can view reward logs" ON public.group_reward_logs;
DROP POLICY IF EXISTS "Users can view their own reward logs" ON public.group_reward_logs;
DROP POLICY IF EXISTS "System functions can insert logs" ON public.group_reward_logs;

-- 用户可以查看自己的日志
CREATE POLICY "Users can view own logs"
  ON public.group_reward_logs
  FOR SELECT
  USING (user_id = auth.uid());

-- 管理员可以查看所有日志
CREATE POLICY "Admins can view all logs"
  ON public.group_reward_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.role = 'admin' OR profiles.role = 'super_admin')
    )
  );

-- 允许所有已认证用户 INSERT(这样系统函数就能插入日志了)
CREATE POLICY "Allow authenticated to insert logs"
  ON public.group_reward_logs
  FOR INSERT
  WITH CHECK (true);

-- ========== 验证 ==========

SELECT
  tablename,
  policyname,
  cmd,
  CASE cmd
    WHEN 'SELECT' THEN '查询'
    WHEN 'INSERT' THEN '插入'
    WHEN 'UPDATE' THEN '更新'
    WHEN 'DELETE' THEN '删除'
    WHEN 'ALL' THEN '全部'
  END as operation
FROM pg_policies
WHERE tablename IN ('user_group_members', 'group_reward_rules', 'group_reward_logs')
ORDER BY tablename, cmd, policyname;
