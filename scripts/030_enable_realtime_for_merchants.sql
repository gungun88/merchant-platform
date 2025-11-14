-- 为 merchants 表启用 Supabase Realtime
-- 这样前端才能实时接收数据库变化

-- 1. 检查当前 Realtime 发布状态
SELECT
  schemaname,
  tablename,
  'realtime' = ANY(string_to_array(current_setting('rls.realtime_publication_tables', true), ',')) as has_realtime
FROM pg_tables
WHERE tablename = 'merchants';

-- 2. 为 merchants 表启用 Realtime
-- 注意：这需要在 Supabase Dashboard 的 Database > Replication 中手动启用
-- 或者通过以下 SQL 命令启用（需要超级用户权限）

-- 如果 realtime 发布不存在，创建它
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
  ) THEN
    CREATE PUBLICATION supabase_realtime FOR ALL TABLES;
  END IF;
END $$;

-- 将 merchants 表添加到 realtime 发布中
-- 注意：如果表已经在发布中，这个命令会报错，可以忽略
DO $$
BEGIN
  -- 先尝试删除表（如果存在）
  BEGIN
    ALTER PUBLICATION supabase_realtime DROP TABLE merchants;
  EXCEPTION
    WHEN undefined_object THEN
      NULL; -- 忽略错误
  END;

  -- 然后添加表
  ALTER PUBLICATION supabase_realtime ADD TABLE merchants;

  RAISE NOTICE 'merchants 表已添加到 Realtime 发布';
END $$;

-- 3. 验证配置
SELECT
  pubname,
  schemaname,
  tablename
FROM pg_publication_tables
WHERE tablename = 'merchants';

-- 4. 显示当前 Realtime 配置的所有表
SELECT
  pubname,
  schemaname,
  tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
ORDER BY tablename;
