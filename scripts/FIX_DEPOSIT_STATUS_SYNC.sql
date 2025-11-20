-- ====================================================================
-- 修复押金商家状态同步问题
-- 用途: 修复"申请已批准但商家状态未更新"的数据不一致问题
-- ====================================================================

-- ============================================================
-- 使用须知
-- ============================================================
-- 此脚本会自动检测并修复以下情况:
-- 1. deposit_merchant_applications 表中申请状态为 'approved'
-- 2. 但对应的 merchants 表中 is_deposit_merchant 仍为 false
-- 3. 或 deposit_status 不是 'paid'
--
-- 执行前请先运行 DEBUG_DEPOSIT_STATUS.sql 确认问题
-- ============================================================

-- 第一步: 查看需要修复的记录
SELECT
  '=== 需要修复的记录 ===' AS info,
  m.id AS merchant_id,
  m.name AS merchant_name,
  m.user_id,
  m.is_deposit_merchant AS current_is_deposit,
  m.deposit_status AS current_deposit_status,
  m.deposit_amount AS current_deposit_amount,
  dma.application_status,
  dma.deposit_amount AS application_deposit_amount,
  dma.approved_at,
  dma.approved_by
FROM merchants m
INNER JOIN deposit_merchant_applications dma ON m.id = dma.merchant_id
WHERE dma.application_status = 'approved'
  AND (
    m.is_deposit_merchant = false
    OR m.deposit_status != 'paid'
    OR m.deposit_amount IS NULL
    OR m.deposit_amount = 0
  );

-- 第二步: 执行修复（更新商家状态）
UPDATE merchants m
SET
  is_deposit_merchant = true,
  deposit_status = 'paid',
  deposit_amount = dma.deposit_amount,
  deposit_paid_at = COALESCE(dma.approved_at, NOW()),
  updated_at = NOW()
FROM deposit_merchant_applications dma
WHERE m.id = dma.merchant_id
  AND dma.application_status = 'approved'
  AND (
    m.is_deposit_merchant = false
    OR m.deposit_status != 'paid'
    OR m.deposit_amount IS NULL
    OR m.deposit_amount = 0
  );

-- 第三步: 验证修复结果
SELECT
  '=== 修复后的状态 ===' AS info,
  m.id AS merchant_id,
  m.name AS merchant_name,
  m.is_deposit_merchant,
  m.deposit_status,
  m.deposit_amount,
  m.deposit_paid_at,
  dma.application_status,
  CASE
    WHEN m.is_deposit_merchant = true AND m.deposit_status = 'paid' THEN '✓ 状态正确'
    ELSE '✗ 仍有问题'
  END AS status
FROM merchants m
INNER JOIN deposit_merchant_applications dma ON m.id = dma.merchant_id
WHERE dma.application_status = 'approved';

-- 完成提示
SELECT
  '✓ 押金商家状态同步修复完成' AS status,
  '请刷新浏览器并重新登录查看结果' AS next_step,
  NOW() AS executed_at;
