-- =============================================
-- 检查数据库迁移完整性
-- 用于验证所有迁移脚本是否都正确执行
-- =============================================

-- 1. 检查所有表是否都已创建
SELECT
  '1. 检查表数量' as check_type,
  COUNT(*) as count,
  CASE
    WHEN COUNT(*) >= 25 THEN '✅ 表已创建完整'
    WHEN COUNT(*) >= 15 THEN '⚠️ 部分表缺失'
    ELSE '❌ 大量表缺失'
  END as status
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE';

-- 2. 列出所有已创建的表
SELECT
  '2. 已创建的表列表' as info,
  table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- 3. 检查关键表是否存在
SELECT
  '3. 关键表检查' as check_type,
  table_name,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.tables t
      WHERE t.table_schema = 'public'
        AND t.table_name = expected_tables.table_name
    ) THEN '✅ 存在'
    ELSE '❌ 缺失'
  END as status
FROM (
  VALUES
    ('profiles'),
    ('merchants'),
    ('favorites'),
    ('point_transactions'),
    ('notifications'),
    ('invitations'),
    ('partners'),
    ('deposit_merchant_applications'),
    ('deposit_refund_applications'),
    ('reports'),
    ('announcements'),
    ('system_settings'),
    ('admin_operation_logs'),
    ('coin_exchange_records'),
    ('scheduled_point_transfers'),
    ('platform_income')
) AS expected_tables(table_name);

-- 4. 检查 profiles 表的关键字段
SELECT
  '4. profiles 表字段检查' as check_type,
  column_name,
  data_type,
  '✅ 存在' as status
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'profiles'
  AND column_name IN (
    'role',              -- 032 创建
    'points',            -- 基础字段
    'is_merchant',       -- 基础字段
    'email',             -- 051 添加
    'user_number',       -- 064 添加
    'low_points_notified' -- 047 添加
  )
ORDER BY column_name;

-- 5. 检查 system_settings 表是否存在且有数据
SELECT
  '5. 系统设置检查' as check_type,
  CASE
    WHEN EXISTS (SELECT 1 FROM system_settings) THEN '✅ 已初始化'
    ELSE '❌ 未初始化'
  END as status,
  COUNT(*) as record_count
FROM system_settings;

-- 6. 检查 RLS 策略数量
SELECT
  '6. RLS 策略检查' as check_type,
  COUNT(*) as policy_count,
  CASE
    WHEN COUNT(*) >= 50 THEN '✅ 策略完整'
    WHEN COUNT(*) >= 30 THEN '⚠️ 部分策略可能缺失'
    ELSE '❌ 大量策略缺失'
  END as status
FROM pg_policies
WHERE schemaname = 'public';

-- 7. 检查存储策略
SELECT
  '7. Storage 策略检查' as check_type,
  COUNT(*) as policy_count,
  CASE
    WHEN COUNT(*) >= 5 THEN '✅ 存储策略已配置'
    WHEN COUNT(*) >= 1 THEN '⚠️ 部分存储策略缺失'
    ELSE '❌ 存储策略未配置'
  END as status
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects';

-- 8. 检查 Realtime 是否启用
SELECT
  '8. Realtime 检查' as check_type,
  COUNT(*) as table_count,
  CASE
    WHEN COUNT(*) >= 3 THEN '✅ Realtime 已启用'
    WHEN COUNT(*) >= 1 THEN '⚠️ 部分表未启用'
    ELSE '❌ Realtime 未启用'
  END as status
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime';

-- 9. 检查触发器数量
SELECT
  '9. 触发器检查' as check_type,
  COUNT(*) as trigger_count,
  CASE
    WHEN COUNT(*) >= 5 THEN '✅ 触发器已创建'
    WHEN COUNT(*) >= 1 THEN '⚠️ 部分触发器可能缺失'
    ELSE '❌ 触发器未创建'
  END as status
FROM information_schema.triggers
WHERE trigger_schema = 'public';

-- 10. 检查函数数量
SELECT
  '10. 函数检查' as check_type,
  COUNT(*) as function_count,
  CASE
    WHEN COUNT(*) >= 5 THEN '✅ 函数已创建'
    WHEN COUNT(*) >= 1 THEN '⚠️ 部分函数可能缺失'
    ELSE '❌ 函数未创建'
  END as status
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_type = 'FUNCTION';

-- 11. 最终总结
SELECT
  '========== 总结 ==========' as summary,
  CASE
    WHEN (
      (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public') >= 25
      AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'role')
      AND EXISTS (SELECT 1 FROM system_settings)
      AND (SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public') >= 50
    ) THEN '✅ 数据库迁移完整,可以进行下一步'
    ELSE '⚠️ 数据库迁移不完整,请检查上面的详细信息'
  END as result;

-- =============================================
-- 使用说明:
-- 1. 在 Supabase SQL Editor 中执行本脚本
-- 2. 查看每个检查项的状态
-- 3. 如果所有项都是 ✅,说明迁移完整
-- 4. 如果有 ❌ 或 ⚠️,说明需要补充执行某些脚本
-- =============================================
