-- 为 deposit_refund_applications 表设置 RLS 策略
-- 让管理员可以查看所有退还申请,普通用户只能查看自己的申请

-- 首先确保 RLS 已启用
ALTER TABLE deposit_refund_applications ENABLE ROW LEVEL SECURITY;

-- 删除可能存在的旧策略
DROP POLICY IF EXISTS "Users can view own refund applications" ON deposit_refund_applications;
DROP POLICY IF EXISTS "Admins can view all refund applications" ON deposit_refund_applications;
DROP POLICY IF EXISTS "Users can insert own refund applications" ON deposit_refund_applications;
DROP POLICY IF EXISTS "Admins can update refund applications" ON deposit_refund_applications;

-- 1. 用户可以查看自己的退还申请
CREATE POLICY "Users can view own refund applications"
ON deposit_refund_applications
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- 2. 管理员可以查看所有退还申请
CREATE POLICY "Admins can view all refund applications"
ON deposit_refund_applications
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('admin', 'super_admin')
  )
);

-- 3. 用户可以插入自己的退还申请
CREATE POLICY "Users can insert own refund applications"
ON deposit_refund_applications
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- 4. 管理员可以更新任何退还申请(审核)
CREATE POLICY "Admins can update refund applications"
ON deposit_refund_applications
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('admin', 'super_admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
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
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'deposit_refund_applications';
