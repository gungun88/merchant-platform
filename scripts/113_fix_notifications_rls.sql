-- 修复 user_notifications 表的 RLS 策略
-- 允许系统函数为任何用户创建通知

-- 1. 查看现有策略
SELECT
  policyname,
  cmd,
  CASE
    WHEN qual IS NOT NULL THEN '有 USING 子句'
    ELSE '无 USING 子句'
  END as has_using,
  CASE
    WHEN with_check IS NOT NULL THEN '有 WITH CHECK 子句'
    ELSE '无 WITH CHECK 子句'
  END as has_with_check
FROM pg_policies
WHERE tablename = 'user_notifications';

-- 2. 删除可能存在的旧策略
DROP POLICY IF EXISTS "Allow authenticated to insert notifications" ON public.user_notifications;
DROP POLICY IF EXISTS "Users can manage own notifications" ON public.user_notifications;

-- 3. 添加允许所有认证用户 INSERT 的策略
-- 这样 SECURITY DEFINER 函数就能为任何用户创建通知了
CREATE POLICY "Allow authenticated to insert notifications"
  ON public.user_notifications
  FOR INSERT
  WITH CHECK (true);

-- 4. 确保用户可以查看和更新自己的通知
CREATE POLICY "Users can manage own notifications"
  ON public.user_notifications
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 5. 验证策略
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
WHERE tablename = 'user_notifications'
ORDER BY cmd, policyname;
