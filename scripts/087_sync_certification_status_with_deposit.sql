-- ============================================
-- 文件: 087_sync_certification_status_with_deposit.sql
-- 描述: 修复押金商家认证状态同步问题
-- 作者: System
-- 创建日期: 2025-11-19
-- ============================================

-- 说明:
-- 1. 当商家成为押金商家时,自动将 certification_status 设置为"已认证"
-- 2. 当商家失去押金商家身份时,自动将 certification_status 设置为"待认证"
-- 3. 创建触发器确保数据一致性
-- 4. 更新现有押金商家的认证状态

BEGIN;

-- ============================================
-- 第一步: 更新现有押金商家的认证状态
-- ============================================
UPDATE merchants
SET certification_status = '已认证'
WHERE is_deposit_merchant = true
  AND deposit_status = 'paid'
  AND certification_status != '已认证';

-- 记录更新的商家数量
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO updated_count
  FROM merchants
  WHERE is_deposit_merchant = true
    AND deposit_status = 'paid'
    AND certification_status = '已认证';

  RAISE NOTICE '已更新 % 个押金商家的认证状态为"已认证"', updated_count;
END $$;

-- ============================================
-- 第二步: 创建触发器函数 - 自动同步认证状态
-- ============================================

-- 删除旧的触发器(如果存在)
DROP TRIGGER IF EXISTS sync_certification_status_trigger ON merchants;
DROP FUNCTION IF EXISTS sync_certification_status();

-- 创建触发器函数
CREATE OR REPLACE FUNCTION sync_certification_status()
RETURNS TRIGGER AS $$
BEGIN
  -- 当商家成为押金商家且押金状态为已缴纳时,自动设置为"已认证"
  IF NEW.is_deposit_merchant = true AND NEW.deposit_status = 'paid' THEN
    NEW.certification_status := '已认证';
    RAISE NOTICE '商家 % 已自动设置为"已认证"', NEW.name;

  -- 当商家失去押金商家身份或押金状态不是已缴纳时,设置为"待认证"
  ELSIF (NEW.is_deposit_merchant = false OR NEW.deposit_status != 'paid')
    AND OLD.is_deposit_merchant = true THEN
    NEW.certification_status := '待认证';
    RAISE NOTICE '商家 % 已自动设置为"待认证"', NEW.name;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 第三步: 创建触发器
-- ============================================
CREATE TRIGGER sync_certification_status_trigger
  BEFORE UPDATE ON merchants
  FOR EACH ROW
  WHEN (
    -- 只在以下情况触发:
    -- 1. is_deposit_merchant 字段发生变化
    -- 2. deposit_status 字段发生变化
    OLD.is_deposit_merchant IS DISTINCT FROM NEW.is_deposit_merchant
    OR OLD.deposit_status IS DISTINCT FROM NEW.deposit_status
  )
  EXECUTE FUNCTION sync_certification_status();

-- ============================================
-- 第四步: 验证修复
-- ============================================
DO $$
DECLARE
  deposit_merchant_count INTEGER;
  certified_count INTEGER;
  mismatch_count INTEGER;
BEGIN
  -- 统计押金商家数量
  SELECT COUNT(*) INTO deposit_merchant_count
  FROM merchants
  WHERE is_deposit_merchant = true AND deposit_status = 'paid';

  -- 统计已认证商家数量
  SELECT COUNT(*) INTO certified_count
  FROM merchants
  WHERE certification_status = '已认证';

  -- 统计不一致的商家数量
  SELECT COUNT(*) INTO mismatch_count
  FROM merchants
  WHERE (is_deposit_merchant = true AND deposit_status = 'paid' AND certification_status != '已认证')
     OR (is_deposit_merchant = false AND certification_status = '已认证');

  RAISE NOTICE '===========================================';
  RAISE NOTICE '验证结果:';
  RAISE NOTICE '押金商家总数(已缴纳): %', deposit_merchant_count;
  RAISE NOTICE '已认证商家总数: %', certified_count;
  RAISE NOTICE '状态不一致商家数: %', mismatch_count;
  RAISE NOTICE '===========================================';

  IF mismatch_count > 0 THEN
    RAISE WARNING '发现 % 个商家的认证状态与押金状态不一致', mismatch_count;
  ELSE
    RAISE NOTICE '✓ 所有商家的认证状态与押金状态一致';
  END IF;
END $$;

-- ============================================
-- 第五步: 显示示例数据
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '===========================================';
  RAISE NOTICE '示例商家数据(前5个押金商家):';
  RAISE NOTICE '===========================================';
END $$;

SELECT
  name AS "商家名称",
  is_deposit_merchant AS "是否押金商家",
  deposit_status AS "押金状态",
  certification_status AS "认证状态",
  deposit_amount AS "押金金额"
FROM merchants
WHERE is_deposit_merchant = true
ORDER BY created_at DESC
LIMIT 5;

COMMIT;

-- ============================================
-- 脚本执行完成
-- ============================================
