-- 修复商家表RLS策略，允许商家查看和更新自己的记录（无论is_active状态）

-- 1. 删除旧的SELECT策略
DROP POLICY IF EXISTS "merchants_select_active" ON public.merchants;

-- 2. 创建新的SELECT策略：所有人可以查看激活的商家，或者商家可以查看自己的记录
CREATE POLICY "merchants_select_policy"
  ON public.merchants FOR SELECT
  USING (is_active = true OR auth.uid() = user_id);

-- 3. 验证策略
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'merchants'
ORDER BY policyname;
