-- ====================================================================
-- 押金商家状态排查脚本
-- 用途: 诊断为什么押金商家页面还显示"立即申请"而不是"押金商家"状态
-- ====================================================================

-- ============================================================
-- 第一步: 检查当前登录用户信息
-- ============================================================
-- 说明: 首先需要知道当前登录的是哪个用户
SELECT
  '=== 第一步: 当前用户信息 ===' AS step,
  auth.uid() AS current_user_id,
  (SELECT email FROM auth.users WHERE id = auth.uid()) AS user_email,
  (SELECT username FROM profiles WHERE id = auth.uid()) AS username,
  (SELECT role FROM profiles WHERE id = auth.uid()) AS user_role;

-- ============================================================
-- 第二步: 检查该用户的商家信息
-- ============================================================
-- 说明: 查看该用户名下的商家记录
SELECT
  '=== 第二步: 商家基本信息 ===' AS step,
  m.id AS merchant_id,
  m.name AS merchant_name,
  m.user_id,
  m.is_active AS merchant_is_active,
  m.is_deposit_merchant AS is_deposit_merchant,
  m.deposit_status,
  m.deposit_amount,
  m.deposit_paid_at,
  m.deposit_bonus_claimed,
  m.last_daily_login_reward_at,
  m.created_at AS merchant_created_at
FROM merchants m
WHERE m.user_id = auth.uid();

-- ============================================================
-- 第三步: 检查押金申请记录
-- ============================================================
-- 说明: 查看该商家的所有押金申请记录
SELECT
  '=== 第三步: 押金申请记录 ===' AS step,
  dma.id AS application_id,
  dma.merchant_id,
  dma.user_id,
  dma.deposit_amount,
  dma.application_status,
  dma.payment_proof_url,
  dma.transaction_hash,
  dma.approved_by,
  dma.approved_at,
  dma.rejected_reason,
  dma.admin_note,
  dma.created_at AS application_created_at,
  dma.updated_at AS application_updated_at
FROM deposit_merchant_applications dma
WHERE dma.user_id = auth.uid()
ORDER BY dma.created_at DESC;

-- ============================================================
-- 第四步: 检查 merchants 表的 RLS 策略
-- ============================================================
-- 说明: 确认 RLS 策略是否正确配置
SELECT
  '=== 第四步: merchants 表 RLS 策略 ===' AS step,
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'merchants'
ORDER BY policyname;

-- ============================================================
-- 第五步: 测试用户能否查询到自己的商家
-- ============================================================
-- 说明: 使用与前端相同的查询逻辑测试
SELECT
  '=== 第五步: 测试查询商家 (模拟前端 getUserMerchant) ===' AS step,
  m.*
FROM merchants m
WHERE m.user_id = auth.uid()
LIMIT 1;

-- ============================================================
-- 第六步: 检查 deposit_merchant_applications 表的 RLS 策略
-- ============================================================
SELECT
  '=== 第六步: deposit_merchant_applications 表 RLS 策略 ===' AS step,
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'deposit_merchant_applications'
ORDER BY policyname;

-- ============================================================
-- 第七步: 检查数据一致性
-- ============================================================
-- 说明: 检查是否存在数据不一致的情况
SELECT
  '=== 第七步: 数据一致性检查 ===' AS step,
  m.id AS merchant_id,
  m.name AS merchant_name,
  m.is_deposit_merchant,
  m.deposit_status,
  m.deposit_amount,
  dma.application_status AS latest_application_status,
  dma.approved_at AS latest_approved_at,
  CASE
    WHEN m.is_deposit_merchant = true AND m.deposit_status = 'paid' THEN '✓ 数据一致：是押金商家'
    WHEN m.is_deposit_merchant = false AND dma.application_status = 'approved' THEN '✗ 数据不一致：申请已批准但商家状态未更新'
    WHEN m.is_deposit_merchant = false AND dma.application_status = 'pending' THEN '⏳ 申请待审核'
    WHEN m.is_deposit_merchant = false AND dma.application_status IS NULL THEN '○ 未申请押金商家'
    ELSE '? 其他情况'
  END AS data_consistency_status
FROM merchants m
LEFT JOIN (
  SELECT DISTINCT ON (merchant_id)
    merchant_id,
    application_status,
    approved_at
  FROM deposit_merchant_applications
  ORDER BY merchant_id, created_at DESC
) dma ON m.id = dma.merchant_id
WHERE m.user_id = auth.uid();

-- ============================================================
-- 第八步: 检查是否缺少关键字段
-- ============================================================
-- 说明: 确认 merchants 表是否包含所有必需的押金相关字段
SELECT
  '=== 第八步: merchants 表字段检查 ===' AS step,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'merchants'
  AND column_name IN (
    'is_deposit_merchant',
    'deposit_status',
    'deposit_amount',
    'deposit_paid_at',
    'deposit_refund_requested_at',
    'deposit_refund_completed_at',
    'deposit_refund_status',
    'deposit_bonus_claimed',
    'last_daily_login_reward_at'
  )
ORDER BY column_name;

-- ============================================================
-- 第九步: 检查管理员操作日志
-- ============================================================
-- 说明: 查看是否有管理员批准记录
SELECT
  '=== 第九步: 管理员操作日志 ===' AS step,
  aol.id,
  aol.admin_id,
  (SELECT email FROM auth.users WHERE id = aol.admin_id) AS admin_email,
  aol.operation_type,
  aol.target_type,
  aol.target_id,
  aol.description,
  aol.metadata,
  aol.created_at
FROM admin_operation_logs aol
WHERE aol.operation_type IN ('approve_deposit', 'reject_deposit')
  AND aol.target_id IN (
    SELECT id FROM deposit_merchant_applications WHERE user_id = auth.uid()
  )
ORDER BY aol.created_at DESC
LIMIT 10;

-- ============================================================
-- 诊断结果总结
-- ============================================================
SELECT
  '=== 诊断总结 ===' AS summary,
  CASE
    WHEN NOT EXISTS (SELECT 1 FROM merchants WHERE user_id = auth.uid()) THEN
      '❌ 问题: 未找到商家记录，用户可能未注册商家'
    WHEN EXISTS (
      SELECT 1 FROM merchants
      WHERE user_id = auth.uid()
        AND is_deposit_merchant = false
        AND deposit_status IS NULL
    ) THEN
      '○ 状态: 用户是普通商家，尚未申请押金商家'
    WHEN EXISTS (
      SELECT 1 FROM deposit_merchant_applications
      WHERE user_id = auth.uid()
        AND application_status = 'pending'
    ) THEN
      '⏳ 状态: 押金申请待审核中'
    WHEN EXISTS (
      SELECT 1 FROM merchants m
      INNER JOIN deposit_merchant_applications dma ON m.id = dma.merchant_id
      WHERE m.user_id = auth.uid()
        AND dma.application_status = 'approved'
        AND m.is_deposit_merchant = false
    ) THEN
      '❌ 问题: 申请已批准但商家状态未更新（数据不一致）'
    WHEN EXISTS (
      SELECT 1 FROM merchants
      WHERE user_id = auth.uid()
        AND is_deposit_merchant = true
        AND deposit_status = 'paid'
    ) THEN
      '✓ 状态: 已是押金商家（如果前端仍显示"立即申请"，则是前端缓存或查询问题）'
    ELSE
      '? 未知情况，需要进一步分析'
  END AS diagnosis;

-- ============================================================
-- 推荐的修复操作
-- ============================================================
SELECT
  '=== 推荐的修复操作 ===' AS recommendations,
  CASE
    -- 情况1: 申请已批准但商家状态未更新
    WHEN EXISTS (
      SELECT 1 FROM merchants m
      INNER JOIN deposit_merchant_applications dma ON m.id = dma.merchant_id
      WHERE m.user_id = auth.uid()
        AND dma.application_status = 'approved'
        AND m.is_deposit_merchant = false
    ) THEN
      '需要手动更新商家状态。请执行脚本: FIX_DEPOSIT_STATUS_SYNC.sql'

    -- 情况2: 前端缓存问题
    WHEN EXISTS (
      SELECT 1 FROM merchants
      WHERE user_id = auth.uid()
        AND is_deposit_merchant = true
        AND deposit_status = 'paid'
    ) THEN
      '数据库状态正确，但前端显示错误。建议: 1) 清除浏览器缓存 2) 退出并重新登录 3) 检查前端查询逻辑'

    -- 情况3: RLS 策略问题
    WHEN NOT EXISTS (
      SELECT 1 FROM merchants WHERE user_id = auth.uid()
    ) AND EXISTS (
      SELECT 1 FROM merchants WHERE id = (
        SELECT merchant_id FROM deposit_merchant_applications
        WHERE user_id = auth.uid() LIMIT 1
      )
    ) THEN
      'RLS 策略阻止了查询。请执行: scripts/013_fix_merchants_rls_policies.sql'

    ELSE
      '无法自动诊断，请查看上述步骤的详细输出'
  END AS recommended_action;
