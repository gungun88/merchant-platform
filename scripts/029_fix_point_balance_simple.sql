-- =============================================
-- 修复积分交易余额计算问题 (简化版)
-- 创建时间: 2025-10-30
-- 说明: 只修复 balance_after 计算逻辑,不改变函数行为
-- =============================================

-- 1. 删除之前错误的修复
DROP FUNCTION IF EXISTS public.record_point_transaction(UUID, INTEGER, TEXT, TEXT, UUID, UUID, JSONB);

-- 2. 重新创建函数,只记录交易,不更新积分
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
  -- 获取当前积分
  SELECT points INTO v_current_points
  FROM public.profiles
  WHERE id = p_user_id;

  IF v_current_points IS NULL THEN
    RAISE EXCEPTION 'User profile not found';
  END IF;

  -- 插入交易记录
  -- 注意: balance_after 应该是当前积分,因为这个函数会在积分更新后被调用
  -- 所以 v_current_points 已经是更新后的值
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
    v_current_points, -- 使用当前积分(已经是更新后的值)
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

COMMENT ON FUNCTION public.record_point_transaction IS '记录积分变动(不更新积分,只记录交易)';

-- 3. 修复现有错误的 balance_after 数据
-- 按时间顺序重新计算每个用户的 balance_after

DO $$
DECLARE
  v_user_record RECORD;
  v_transaction_record RECORD;
  v_running_balance INTEGER;
BEGIN
  -- 遍历所有有交易记录的用户
  FOR v_user_record IN
    SELECT DISTINCT user_id
    FROM public.point_transactions
    ORDER BY user_id
  LOOP
    v_running_balance := 0;

    -- 按时间顺序遍历该用户的所有交易
    FOR v_transaction_record IN
      SELECT id, amount, created_at
      FROM public.point_transactions
      WHERE user_id = v_user_record.user_id
      ORDER BY created_at ASC, id ASC
    LOOP
      -- 累加积分
      v_running_balance := v_running_balance + v_transaction_record.amount;

      -- 更新 balance_after
      UPDATE public.point_transactions
      SET balance_after = v_running_balance
      WHERE id = v_transaction_record.id;
    END LOOP;

    -- 验证最终余额是否与 profiles 表一致
    DECLARE
      v_profile_points INTEGER;
    BEGIN
      SELECT points INTO v_profile_points
      FROM public.profiles
      WHERE id = v_user_record.user_id;

      IF v_profile_points IS NOT NULL AND v_profile_points != v_running_balance THEN
        RAISE NOTICE '警告: 用户 % 的积分不一致. Profiles 表: %, 计算结果: %',
          v_user_record.user_id, v_profile_points, v_running_balance;

        -- 更新 profiles 表使其与计算结果一致
        UPDATE public.profiles
        SET points = v_running_balance
        WHERE id = v_user_record.user_id;

        RAISE NOTICE '已将用户 % 的积分更新为正确值: %', v_user_record.user_id, v_running_balance;
      END IF;
    END;
  END LOOP;

  RAISE NOTICE '积分修复完成!';
END $$;

-- =============================================
-- 脚本执行完成
-- =============================================

-- 验证修复结果
SELECT
  u.id as user_id,
  u.email,
  p.points as profile_points,
  (SELECT balance_after FROM point_transactions WHERE user_id = u.id ORDER BY created_at DESC, id DESC LIMIT 1) as last_transaction_balance,
  CASE
    WHEN p.points = (SELECT balance_after FROM point_transactions WHERE user_id = u.id ORDER BY created_at DESC, id DESC LIMIT 1)
    THEN '✓ 一致'
    ELSE '✗ 不一致'
  END as status
FROM auth.users u
JOIN profiles p ON u.id = p.id
WHERE EXISTS (SELECT 1 FROM point_transactions WHERE user_id = u.id)
ORDER BY u.email;
