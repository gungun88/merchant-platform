-- 修复 group_reward_rules 表的 RLS 策略
-- 原策略只有 USING 子句,缺少 WITH CHECK 子句导致 INSERT/UPDATE 失败

-- 1. 删除旧策略
DROP POLICY IF EXISTS "Admins can manage reward rules" ON public.group_reward_rules;

-- 2. 创建新策略,同时包含 USING 和 WITH CHECK
CREATE POLICY "Admins can manage reward rules"
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

-- 3. 同时检查和修复其他表的策略
DROP POLICY IF EXISTS "Admins can manage user groups" ON public.user_groups;

CREATE POLICY "Admins can manage user groups"
  ON public.user_groups
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

DROP POLICY IF EXISTS "Admins can manage group members" ON public.user_group_members;

CREATE POLICY "Admins can manage group members"
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

-- 4. 验证策略是否正确创建
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual IS NOT NULL as has_using,
  with_check IS NOT NULL as has_with_check
FROM pg_policies
WHERE tablename IN ('user_groups', 'user_group_members', 'group_reward_rules')
ORDER BY tablename, policyname;
