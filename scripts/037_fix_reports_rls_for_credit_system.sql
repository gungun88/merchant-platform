-- 修复 reports 表的 RLS 策略，允许管理员更新举报记录
-- 问题：之前的策略可能阻止了通过 service role 更新

-- 1. 删除可能冲突的旧策略
DROP POLICY IF EXISTS "管理员可以更新举报" ON public.reports;
DROP POLICY IF EXISTS "Admins can update reports" ON public.reports;

-- 2. 重新创建管理员更新策略
CREATE POLICY "管理员可以更新举报" ON public.reports
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- 3. 确保 service_role 可以绕过 RLS（应该默认可以，但确认一下）
-- Service role 默认绕过 RLS，无需额外设置

-- 4. 检查 merchants 表的 RLS 更新策略
DROP POLICY IF EXISTS "管理员可以更新商家" ON public.merchants;

CREATE POLICY "管理员可以更新商家" ON public.merchants
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- 5. 验证策略
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE tablename IN ('reports', 'merchants')
  AND schemaname = 'public'
ORDER BY tablename, policyname;

SELECT '✅ RLS 策略已修复' as status;
