-- 检查当前数据库状态
-- 在 Supabase SQL Editor 中执行此脚本

-- 1. 检查所有表是否都存在
SELECT
  'Tables Count' as check_type,
  COUNT(*) as count,
  CASE
    WHEN COUNT(*) >= 20 THEN '✅ 看起来表都创建了'
    WHEN COUNT(*) >= 10 THEN '⚠️ 部分表缺失'
    ELSE '❌ 大部分表缺失,建议重新开始'
  END as status
FROM information_schema.tables
WHERE table_schema = 'public';

-- 2. 检查是否有数据
SELECT
  'merchants' as table_name,
  COUNT(*) as record_count
FROM merchants
UNION ALL
SELECT 'profiles', COUNT(*) FROM profiles
UNION ALL
SELECT 'partners', COUNT(*) FROM partners
UNION ALL
SELECT 'point_transactions', COUNT(*) FROM point_transactions
ORDER BY table_name;

-- 3. 检查是否执行过 084_clean_test_data.sql (如果所有表都是空的,可能执行过)
SELECT
  CASE
    WHEN (SELECT COUNT(*) FROM merchants) = 0
      AND (SELECT COUNT(*) FROM partners) = 0
      AND (SELECT COUNT(*) FROM point_transactions) = 0
    THEN '⚠️ 数据库是空的,可能执行过清空脚本'
    ELSE '✅ 数据库有数据'
  END as data_status;

-- 4. 检查重复的RLS策略(如果有,说明执行了重复脚本)
SELECT
  tablename,
  COUNT(*) as policy_count,
  CASE
    WHEN COUNT(*) > 10 THEN '⚠️ 策略过多,可能有重复'
    ELSE '✅ 正常'
  END as status
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY tablename
HAVING COUNT(*) > 10
ORDER BY policy_count DESC;

-- 5. 总体建议
SELECT
  CASE
    WHEN (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public') < 15
    THEN '❌ 建议重新开始: 表结构不完整'
    WHEN (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public') >= 20
      AND (SELECT COUNT(*) FROM merchants) = 0
    THEN '✅ 数据库已清空,可以直接执行新脚本'
    WHEN (SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public') > 100
    THEN '⚠️ 建议重新开始: RLS策略过多,可能有重复'
    ELSE '✅ 可以继续使用现有数据库,执行缺失的脚本'
  END as recommendation;
