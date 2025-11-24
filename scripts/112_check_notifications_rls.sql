-- 检查并修复 user_notifications 表的 RLS 策略

-- 1. 查看当前策略
SELECT
  schemaname,
  tablename,
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'user_notifications';

-- 2. 检查表是否启用了 RLS
SELECT
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE tablename = 'user_notifications';
