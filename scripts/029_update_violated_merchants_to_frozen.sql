-- 更新之前违规下架的商家,将押金状态设为冻结
-- 适用于已经被下架但押金状态还是 'paid' 的押金商家

-- 查看当前需要更新的商家数量
SELECT
  COUNT(*) as affected_count,
  '需要更新的商家数量' as description
FROM merchants
WHERE is_deposit_merchant = true
  AND is_active = false
  AND deposit_status = 'paid'
  AND deposit_amount > 0;

-- 显示将要更新的商家详情
SELECT
  id,
  name,
  deposit_amount as "押金金额(USDT)",
  deposit_status as "当前押金状态",
  is_active as "是否上架",
  created_at as "创建时间"
FROM merchants
WHERE is_deposit_merchant = true
  AND is_active = false
  AND deposit_status = 'paid'
  AND deposit_amount > 0
ORDER BY created_at DESC;

-- 更新操作:将符合条件的商家押金状态改为 frozen
UPDATE merchants
SET
  deposit_status = 'frozen',
  updated_at = NOW()
WHERE is_deposit_merchant = true
  AND is_active = false
  AND deposit_status = 'paid'
  AND deposit_amount > 0;

-- 验证更新结果
SELECT
  COUNT(*) as updated_count,
  '已更新为冻结状态的商家数量' as description
FROM merchants
WHERE is_deposit_merchant = true
  AND is_active = false
  AND deposit_status = 'frozen';

-- 显示更新后的商家列表
SELECT
  id,
  name,
  deposit_amount as "押金金额(USDT)",
  deposit_status as "押金状态",
  is_active as "是否上架",
  updated_at as "更新时间"
FROM merchants
WHERE is_deposit_merchant = true
  AND deposit_status = 'frozen'
ORDER BY updated_at DESC;
