-- =============================================
-- 修复积分交易余额计算问题
-- 创建时间: 2025-10-30
-- 说明: 修改 record_point_transaction 函数,确保余额计算正确
-- =============================================

-- 1. 删除旧的函数
DROP FUNCTION IF EXISTS public.record_point_transaction(UUID, INTEGER, TEXT, TEXT, UUID, UUID, JSONB);

-- 2. 重新创建函数,同时更新积分和记录交易
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
  v_new_points INTEGER;
  v_transaction_id UUID;
BEGIN
  -- 获取当前积分并锁定该行,防止并发问题
  SELECT points INTO v_current_points
  FROM public.profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF v_current_points IS NULL THEN
    RAISE EXCEPTION 'User profile not found';
  END IF;

  -- 计算新积分
  v_new_points := v_current_points + p_amount;

  -- 更新用户积分
  UPDATE public.profiles
  SET points = v_new_points
  WHERE id = p_user_id;

  -- 插入交易记录,使用新积分作为 balance_after
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
    v_new_points, -- 使用更新后的新积分
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

COMMENT ON FUNCTION public.record_point_transaction IS '记录积分变动并更新用户积分的原子操作函数';

-- 3. 修复现有错误的 balance_after 数据
-- 注意: 这个修复假设交易记录是按时间顺序的

-- 创建临时修复函数
CREATE OR REPLACE FUNCTION public.fix_balance_after_for_user(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_record RECORD;
  v_running_balance INTEGER := 0;
  v_initial_balance INTEGER := 0;
BEGIN
  -- 获取该用户最早的交易记录之前的初始积分
  -- 假设注册时是0分,如果有注册奖励记录,则从第一笔交易开始计算

  -- 按时间顺序遍历所有交易
  FOR v_record IN
    SELECT id, amount, created_at
    FROM public.point_transactions
    WHERE user_id = p_user_id
    ORDER BY created_at ASC
  LOOP
    -- 累加积分
    v_running_balance := v_running_balance + v_record.amount;

    -- 更新 balance_after
    UPDATE public.point_transactions
    SET balance_after = v_running_balance
    WHERE id = v_record.id;
  END LOOP;

  -- 验证最终余额是否与 profiles 表一致
  DECLARE
    v_profile_points INTEGER;
  BEGIN
    SELECT points INTO v_profile_points
    FROM public.profiles
    WHERE id = p_user_id;

    IF v_profile_points != v_running_balance THEN
      RAISE NOTICE 'Warning: Final balance mismatch for user %. Profile: %, Calculated: %',
        p_user_id, v_profile_points, v_running_balance;

      -- 可选: 更新 profiles 表使其与计算结果一致
      -- UPDATE public.profiles SET points = v_running_balance WHERE id = p_user_id;
    END IF;
  END;
END;
$$;

-- 4. 为所有用户修复 balance_after
DO $$
DECLARE
  v_user_record RECORD;
BEGIN
  FOR v_user_record IN
    SELECT DISTINCT user_id
    FROM public.point_transactions
  LOOP
    PERFORM public.fix_balance_after_for_user(v_user_record.user_id);
  END LOOP;
END $$;

-- 5. 清理临时函数
DROP FUNCTION IF EXISTS public.fix_balance_after_for_user(UUID);

-- =============================================
-- 脚本执行完成
-- =============================================

-- 验证修复结果 - 检查所有用户的积分是否一致
SELECT
  u.id as user_id,
  u.email,
  p.points as profile_points,
  (SELECT balance_after FROM point_transactions WHERE user_id = u.id ORDER BY created_at DESC LIMIT 1) as last_transaction_balance,
  CASE
    WHEN p.points = (SELECT balance_after FROM point_transactions WHERE user_id = u.id ORDER BY created_at DESC LIMIT 1)
    THEN '✓ 一致'
    ELSE '✗ 不一致'
  END as status
FROM auth.users u
JOIN profiles p ON u.id = p.id
WHERE EXISTS (SELECT 1 FROM point_transactions WHERE user_id = u.id)
ORDER BY u.email;
