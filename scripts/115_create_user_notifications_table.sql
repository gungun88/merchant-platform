-- 创建 user_notifications 表(如果不存在)

-- 1. 创建表
CREATE TABLE IF NOT EXISTS public.user_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT, -- 我们的函数使用 message
  content TEXT, -- 036脚本使用 content,保留兼容
  is_read BOOLEAN DEFAULT FALSE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  read_at TIMESTAMPTZ
);

-- 2. 创建索引
CREATE INDEX IF NOT EXISTS idx_user_notifications_user_id ON public.user_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_user_notifications_created_at ON public.user_notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_notifications_is_read ON public.user_notifications(user_id, is_read);

-- 3. 启用 RLS
ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;

-- 4. 删除可能存在的旧策略
DROP POLICY IF EXISTS "Allow authenticated to insert notifications" ON public.user_notifications;
DROP POLICY IF EXISTS "Users can manage own notifications" ON public.user_notifications;
DROP POLICY IF EXISTS "Users can view own notifications" ON public.user_notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON public.user_notifications;

-- 5. 创建 RLS 策略

-- 允许所有认证用户 INSERT(系统函数需要)
CREATE POLICY "Allow authenticated to insert notifications"
  ON public.user_notifications
  FOR INSERT
  WITH CHECK (true);

-- 用户可以查看自己的通知
CREATE POLICY "Users can view own notifications"
  ON public.user_notifications
  FOR SELECT
  USING (user_id = auth.uid());

-- 用户可以更新自己的通知(如标记为已读)
CREATE POLICY "Users can update own notifications"
  ON public.user_notifications
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 用户可以删除自己的通知
CREATE POLICY "Users can delete own notifications"
  ON public.user_notifications
  FOR DELETE
  USING (user_id = auth.uid());

-- 6. 验证表和策略
SELECT
  'Table exists' as status,
  COUNT(*) as column_count
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'user_notifications';

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
WHERE tablename = 'user_notifications'
ORDER BY cmd, policyname;
