-- 修复 group_reward_rules 的 RLS 策略
-- 问题: "Admins can modify rules" 使用 FOR ALL,阻止了管理员的 INSERT 操作
-- 原因: FOR ALL 的 WITH CHECK 子句会检查 auth.uid(),但 INSERT 时可能检查失败

-- 删除有问题的策略
DROP POLICY IF EXISTS "Admins can modify rules" ON public.group_reward_rules;

-- 分别为 INSERT, UPDATE, DELETE 创建策略

-- 允许管理员 INSERT
CREATE POLICY "Admins can insert rules"
  ON public.group_reward_rules
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.role = 'admin' OR profiles.role = 'super_admin')
    )
  );

-- 允许管理员 UPDATE
CREATE POLICY "Admins can update rules"
  ON public.group_reward_rules
  FOR UPDATE
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

-- 允许管理员 DELETE
CREATE POLICY "Admins can delete rules"
  ON public.group_reward_rules
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.role = 'admin' OR profiles.role = 'super_admin')
    )
  );

-- 同样修复 user_group_members 表
DROP POLICY IF EXISTS "Admins can modify members" ON public.user_group_members;

CREATE POLICY "Admins can insert members"
  ON public.user_group_members
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.role = 'admin' OR profiles.role = 'super_admin')
    )
  );

CREATE POLICY "Admins can update members"
  ON public.user_group_members
  FOR UPDATE
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

CREATE POLICY "Admins can delete members"
  ON public.user_group_members
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.role = 'admin' OR profiles.role = 'super_admin')
    )
  );

-- 验证策略
SELECT
  tablename,
  policyname,
  cmd,
  CASE cmd
    WHEN 'SELECT' THEN '查询'
    WHEN 'INSERT' THEN '插入'
    WHEN 'UPDATE' THEN '更新'
    WHEN 'DELETE' THEN '删除'
  END as operation
FROM pg_policies
WHERE tablename IN ('user_group_members', 'group_reward_rules')
ORDER BY tablename, cmd;
