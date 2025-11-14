-- 添加管理员对商家表的 RLS 策略
-- 允许管理员查询、更新、删除所有商家

-- 1. 添加管理员可以更新所有商家的策略
CREATE POLICY "merchants_admin_update"
  ON public.merchants FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- 2. 添加管理员可以删除所有商家的策略
CREATE POLICY "merchants_admin_delete"
  ON public.merchants FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- 3. 添加管理员可以查看所有商家的策略（包括下架的）
DROP POLICY IF EXISTS "merchants_select_policy" ON public.merchants;

CREATE POLICY "merchants_select_policy"
  ON public.merchants FOR SELECT
  USING (
    is_active = true -- 所有人可以查看已上架的商家
    OR auth.uid() = user_id -- 商家可以查看自己的记录
    OR EXISTS ( -- 管理员可以查看所有商家
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- 验证策略
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE tablename = 'merchants'
ORDER BY policyname;
