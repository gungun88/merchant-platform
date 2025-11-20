-- ============================================
-- 文件: 091_fix_record_point_transaction_function.sql
-- 描述: 修复 record_point_transaction 函数的 balance_after 计算逻辑
-- 作者: System
-- 创建日期: 2025-11-20
-- ============================================

-- 说明:
-- 原函数假设在积分更新AFTER调用,所以 balance_after = v_current_points
-- 但实际代码中应该在积分更新BEFORE调用,所以需要修改为 balance_after = v_current_points + p_amount

BEGIN;

DROP FUNCTION IF EXISTS public.record_point_transaction(UUID, INTEGER, TEXT, TEXT, UUID, UUID, JSONB);

CREATE OR REPLACE FUNCTION public.record_point_transaction(
  p_user_id UUID,
  p_amount INTEGER,
  p_type TEXT,
  p_description TEXT,
  p_related_user_id UUID DEFAULT NULL,
  p_related_merchant_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_points INTEGER;
  v_transaction_id UUID;
BEGIN
  -- 获取当前积分（积分更新之前的值）
  SELECT points INTO v_current_points
  FROM public.profiles
  WHERE id = p_user_id;

  IF v_current_points IS NULL THEN
    RAISE EXCEPTION 'User profile not found';
  END IF;

  -- 插入交易记录
  -- balance_after = 当前积分 + 变动金额（因为这个函数在积分更新BEFORE调用）
  INSERT INTO public.point_transactions (
    user_id,
    amount,
    balance_after,
    type,
    description,
    related_user_id,
    related_merchant_id,
    metadata
  ) VALUES (
    p_user_id,
    p_amount,
    v_current_points + p_amount, -- 计算交易后的余额
    p_type,
    p_description,
    p_related_user_id,
    p_related_merchant_id,
    p_metadata
  )
  RETURNING id INTO v_transaction_id;

  RETURN v_transaction_id;
END;
$$;

COMMENT ON FUNCTION public.record_point_transaction IS '记录积分变动(在积分更新前调用,自动计算 balance_after)';

-- 授予权限
GRANT EXECUTE ON FUNCTION public.record_point_transaction TO authenticated, anon, service_role;

COMMIT;

-- ============================================
-- 验证函数更新成功
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '==========================================='  ;
  RAISE NOTICE '✅ record_point_transaction 函数已更新';
  RAISE NOTICE '   - balance_after = v_current_points + p_amount';
  RAISE NOTICE '   - 适用于在积分更新前调用的场景';
  RAISE NOTICE '==========================================='  ;
END $$;
