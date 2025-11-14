-- 启用 profiles 表的 Realtime 功能

-- 1. 为 profiles 表启用 Realtime 复制
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;

-- 注意：
-- 1. 这个命令会启用 profiles 表的实时更新功能
-- 2. 现在当 profiles 表中的数据发生变化时，前端会实时收到通知
-- 3. 这样商家的积分变化会立即反映在导航栏中，无需刷新页面

-- 验证是否成功启用：
-- SELECT schemaname, tablename
-- FROM pg_publication_tables
-- WHERE pubname = 'supabase_realtime';
