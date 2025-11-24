-- 检查用户组系统的所有数据库对象是否存在

-- 检查表
SELECT
  'user_groups' as object_name,
  CASE WHEN EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'user_groups')
    THEN '✅ 存在' ELSE '❌ 不存在' END as status
UNION ALL
SELECT
  'user_group_members',
  CASE WHEN EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'user_group_members')
    THEN '✅ 存在' ELSE '❌ 不存在' END
UNION ALL
SELECT
  'group_reward_rules',
  CASE WHEN EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'group_reward_rules')
    THEN '✅ 存在' ELSE '❌ 不存在' END
UNION ALL
SELECT
  'group_reward_logs',
  CASE WHEN EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'group_reward_logs')
    THEN '✅ 存在' ELSE '❌ 不存在' END
UNION ALL
-- 检查函数
SELECT
  'process_group_rewards()',
  CASE WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'process_group_rewards')
    THEN '✅ 存在' ELSE '❌ 不存在' END
UNION ALL
SELECT
  'trigger_group_reward()',
  CASE WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'trigger_group_reward')
    THEN '✅ 存在' ELSE '❌ 不存在' END
ORDER BY object_name;
