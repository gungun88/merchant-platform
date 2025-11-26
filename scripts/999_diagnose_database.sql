-- ====================================================================
-- 数据库全面诊断脚本
-- 用途: 检查数据库表结构、字段、触发器、函数等,找出潜在问题
-- ====================================================================

-- ============================================================
-- 第一部分: 检查 merchants 表结构
-- ============================================================
SELECT
  '=== merchants 表字段检查 ===' AS info,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'merchants'
ORDER BY ordinal_position;

-- 检查 merchants 表是否缺失关键字段
SELECT
  '=== merchants 表缺失字段检查 ===' AS info,
  CASE
    WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'merchants' AND column_name = 'is_deposit_merchant')
    THEN '✓' ELSE '✗ 缺失'
  END AS is_deposit_merchant,
  CASE
    WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'merchants' AND column_name = 'deposit_status')
    THEN '✓' ELSE '✗ 缺失'
  END AS deposit_status,
  CASE
    WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'merchants' AND column_name = 'deposit_amount')
    THEN '✓' ELSE '✗ 缺失'
  END AS deposit_amount,
  CASE
    WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'merchants' AND column_name = 'deposit_bonus_claimed')
    THEN '✓' ELSE '✗ 缺失'
  END AS deposit_bonus_claimed,
  CASE
    WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'merchants' AND column_name = 'pin_type')
    THEN '✓' ELSE '✗ 缺失'
  END AS pin_type,
  CASE
    WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'merchants' AND column_name = 'pin_expires_at')
    THEN '✓' ELSE '✗ 缺失'
  END AS pin_expires_at,
  CASE
    WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'merchants' AND column_name = 'is_topped')
    THEN '✓' ELSE '✗ 缺失'
  END AS is_topped,
  CASE
    WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'merchants' AND column_name = 'topped_until')
    THEN '✓' ELSE '✗ 缺失'
  END AS topped_until,
  CASE
    WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'merchants' AND column_name = 'is_active')
    THEN '✓' ELSE '✗ 缺失'
  END AS is_active;

-- ============================================================
-- 第二部分: 检查 profiles 表结构
-- ============================================================
SELECT
  '=== profiles 表字段检查 ===' AS info,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'profiles'
ORDER BY ordinal_position;

-- 检查 profiles 表是否缺失关键字段
SELECT
  '=== profiles 表缺失字段检查 ===' AS info,
  CASE
    WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'user_number')
    THEN '✓' ELSE '✗ 缺失'
  END AS user_number,
  CASE
    WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'points')
    THEN '✓' ELSE '✗ 缺失'
  END AS points,
  CASE
    WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'role')
    THEN '✓' ELSE '✗ 缺失'
  END AS role,
  CASE
    WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'is_merchant')
    THEN '✓' ELSE '✗ 缺失'
  END AS is_merchant,
  CASE
    WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'invitation_code')
    THEN '✓' ELSE '✗ 缺失'
  END AS invitation_code;

-- ============================================================
-- 第三部分: 检查关键表是否存在
-- ============================================================
SELECT
  '=== 关键表存在性检查 ===' AS info,
  CASE
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'merchants')
    THEN '✓' ELSE '✗ 不存在'
  END AS merchants,
  CASE
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles')
    THEN '✓' ELSE '✗ 不存在'
  END AS profiles,
  CASE
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'point_transactions')
    THEN '✓' ELSE '✗ 不存在'
  END AS point_transactions,
  CASE
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'notifications')
    THEN '✓' ELSE '✗ 不存在'
  END AS notifications,
  CASE
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'deposit_merchant_applications')
    THEN '✓' ELSE '✗ 不存在'
  END AS deposit_merchant_applications,
  CASE
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'deposit_refund_applications')
    THEN '✓' ELSE '✗ 不存在'
  END AS deposit_refund_applications,
  CASE
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'admin_operation_logs')
    THEN '✓' ELSE '✗ 不存在'
  END AS admin_operation_logs,
  CASE
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'deposit_top_up_applications')
    THEN '✓' ELSE '✗ 不存在'
  END AS deposit_top_up_applications;

-- ============================================================
-- 第四部分: 检查触发器
-- ============================================================
SELECT
  '=== 触发器检查 ===' AS info,
  trigger_name,
  event_object_table AS table_name,
  event_manipulation AS trigger_event,
  action_timing
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;

-- ============================================================
-- 第五部分: 检查函数
-- ============================================================
SELECT
  '=== 数据库函数检查 ===' AS info,
  routine_name,
  routine_type,
  data_type AS return_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_type = 'FUNCTION'
ORDER BY routine_name;

-- ============================================================
-- 第六部分: 检查 RLS 策略
-- ============================================================
SELECT
  '=== RLS 策略检查 ===' AS info,
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- ============================================================
-- 第七部分: 检查索引
-- ============================================================
SELECT
  '=== 索引检查 ===' AS info,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

-- ============================================================
-- 第八部分: 检查外键约束
-- ============================================================
SELECT
  '=== 外键约束检查 ===' AS info,
  tc.table_name,
  tc.constraint_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
ORDER BY tc.table_name, tc.constraint_name;

-- ============================================================
-- 第九部分: 检查数据一致性
-- ============================================================

-- 检查商家与用户的关联
SELECT
  '=== 商家数据一致性检查 ===' AS info,
  COUNT(*) AS total_merchants,
  COUNT(CASE WHEN is_deposit_merchant = true THEN 1 END) AS deposit_merchants,
  COUNT(CASE WHEN is_active = true THEN 1 END) AS active_merchants,
  COUNT(CASE WHEN is_topped = true THEN 1 END) AS topped_merchants
FROM merchants;

-- 检查用户数据
SELECT
  '=== 用户数据一致性检查 ===' AS info,
  COUNT(*) AS total_users,
  COUNT(CASE WHEN is_merchant = true THEN 1 END) AS merchant_users,
  COUNT(CASE WHEN role = 'admin' THEN 1 END) AS admin_users,
  COUNT(CASE WHEN role = 'super_admin' THEN 1 END) AS super_admin_users
FROM profiles;

-- 检查孤立的商家记录（用户不存在）
SELECT
  '=== 孤立商家记录检查 ===' AS info,
  m.id,
  m.name,
  m.user_id
FROM merchants m
LEFT JOIN profiles p ON m.user_id = p.id
WHERE p.id IS NULL;

-- 检查点数交易记录
SELECT
  '=== 积分交易记录统计 ===' AS info,
  COUNT(*) AS total_transactions,
  COUNT(CASE WHEN amount > 0 THEN 1 END) AS positive_transactions,
  COUNT(CASE WHEN amount < 0 THEN 1 END) AS negative_transactions,
  COUNT(CASE WHEN balance_after IS NULL THEN 1 END) AS missing_balance_after
FROM point_transactions;

-- ============================================================
-- 第十部分: 检查最近的错误（如果有错误日志表）
-- ============================================================
-- 注意：此查询需要有错误日志表才能执行

-- 完成提示
SELECT
  '✓ 数据库诊断完成' AS status,
  '请检查以上输出,找出缺失的表、字段、触发器或数据不一致的问题' AS description,
  NOW() AS executed_at;
