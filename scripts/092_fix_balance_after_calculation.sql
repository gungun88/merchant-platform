-- ============================================
-- 文件: 092_fix_balance_after_calculation.sql
-- 描述: 修复 balance_after 计算错误的问题
-- 作者: System
-- 创建日期: 2025-11-20
-- ============================================

BEGIN;

-- 1. 先修复数据库函数，确保使用正确的逻辑
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
  v_new_balance INTEGER;
  v_transaction_id UUID;
BEGIN
  -- 获取当前积分
  SELECT points INTO v_current_points
  FROM public.profiles
  WHERE id = p_user_id
  FOR UPDATE; -- 锁定行，防止并发问题

  IF v_current_points IS NULL THEN
    RAISE EXCEPTION 'User profile not found';
  END IF;

  -- 计算新余额
  v_new_balance := v_current_points + p_amount;

  -- 检查余额是否足够（对于负数变动）
  IF v_new_balance < 0 THEN
    RAISE EXCEPTION 'Insufficient points balance';
  END IF;

  -- 更新用户积分
  UPDATE public.profiles
  SET points = v_new_balance
  WHERE id = p_user_id;

  -- 插入交易记录，balance_after 为更新后的余额
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
    v_new_balance, -- 使用更新后的余额
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

COMMENT ON FUNCTION public.record_point_transaction IS '记录积分变动并自动更新用户积分余额';

-- 授予权限
GRANT EXECUTE ON FUNCTION public.record_point_transaction TO authenticated, anon, service_role;

-- 2. 修复所有现有记录的 balance_after 字段
-- 按时间顺序重新计算每条记录的余额

DO $$
DECLARE
  v_user RECORD;
  v_transaction RECORD;
  v_running_balance INTEGER;
BEGIN
  -- 对每个用户处理
  FOR v_user IN
    SELECT DISTINCT user_id
    FROM public.point_transactions
    ORDER BY user_id
  LOOP
    v_running_balance := 0;

    -- 按时间顺序处理该用户的所有交易
    FOR v_transaction IN
      SELECT id, amount
      FROM public.point_transactions
      WHERE user_id = v_user.user_id
      ORDER BY created_at ASC, id ASC
    LOOP
      -- 累加余额
      v_running_balance := v_running_balance + v_transaction.amount;

      -- 更新记录的 balance_after
      UPDATE public.point_transactions
      SET balance_after = v_running_balance
      WHERE id = v_transaction.id;
    END LOOP;

    -- 更新用户的当前积分为最终余额
    UPDATE public.profiles
    SET points = v_running_balance
    WHERE id = v_user.user_id;

    RAISE NOTICE '用户 % 的积分记录已修复，当前积分: %', v_user.user_id, v_running_balance;
  END LOOP;
END $$;

COMMIT;

-- ============================================
-- 验证修复结果
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '===========================================';
  RAISE NOTICE '✅ 积分余额计算已修复';
  RAISE NOTICE '   1. record_point_transaction 函数已更新';
  RAISE NOTICE '   2. 所有历史记录的 balance_after 已重新计算';
  RAISE NOTICE '   3. 用户的当前积分已同步更新';
  RAISE NOTICE '===========================================';
END $$;
