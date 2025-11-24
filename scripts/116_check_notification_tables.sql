-- 检查通知相关的表

-- 1. 列出所有与通知相关的表
SELECT
  table_name,
  table_schema
FROM information_schema.tables
WHERE table_schema = 'public'
  AND (
    table_name = 'notifications'
    OR table_name = 'user_notifications'
  )
ORDER BY table_name;

-- 2. 如果 notifications 表存在,查看它的结构
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'notifications'
ORDER BY ordinal_position;

-- 3. 如果 user_notifications 表存在,查看它的结构
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'user_notifications'
ORDER BY ordinal_position;

-- 4. 检查 user_notifications 表中的数据
SELECT
  id,
  user_id,
  type,
  title,
  message,
  content,
  created_at
FROM public.user_notifications
ORDER BY created_at DESC
LIMIT 10;
