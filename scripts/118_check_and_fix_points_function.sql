-- 检查并修复 record_point_transaction 函数
-- 确保函数能正确更新 profiles 表的积分

-- 1. 查看当前函数定义
DO $$
BEGIN
  RAISE NOTICE '检查 record_point_transaction 函数...';
END $$;

SELECT
  proname as function_name,
  pg_get_functiondef(oid) as definition
FROM pg_proc
WHERE proname = 'record_point_transaction'
  AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

-- 2. 重新创建函数,确保逻辑正确
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
SET search_path = public
AS $$
DECLARE
  v_current_points INTEGER;
  v_new_balance INTEGER;
  v_transaction_id UUID;
BEGIN
  -- 获取当前积分并锁定行
  SELECT COALESCE(points, 0) INTO v_current_points
  FROM public.profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User profile not found: %', p_user_id;
  END IF;

  -- 计算新余额
  v_new_balance := v_current_points + p_amount;

  -- 检查余额是否足够（对于负数变动）
  IF v_new_balance < 0 THEN
    RAISE EXCEPTION 'Insufficient points balance. Current: %, Required: %', v_current_points, -p_amount;
  END IF;

  -- 先插入交易记录
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
    v_new_balance,
    p_type,
    p_description,
    p_related_user_id,
    p_related_merchant_id,
    p_metadata
  )
  RETURNING id INTO v_transaction_id;

  -- 然后更新用户积分
  UPDATE public.profiles
  SET
    points = v_new_balance,
    updated_at = NOW()
  WHERE id = p_user_id;

  -- 验证更新
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Failed to update user points';
  END IF;

  RAISE NOTICE '积分交易成功: 用户=%, 变动=%, 新余额=%, 交易ID=%', p_user_id, p_amount, v_new_balance, v_transaction_id;

  RETURN v_transaction_id;
END;
$$;

COMMENT ON FUNCTION public.record_point_transaction IS '记录积分变动并自动更新用户积分余额(已修复)';

-- 授予权限
GRANT EXECUTE ON FUNCTION public.record_point_transaction TO authenticated, anon, service_role;

-- 3. 修复当前用户的积分 - 重新计算所有交易
DO $$
DECLARE
  v_user RECORD;
  v_correct_balance INTEGER;
  v_current_balance INTEGER;
BEGIN
  RAISE NOTICE '开始修复用户积分...';

  FOR v_user IN
    SELECT DISTINCT user_id FROM public.point_transactions
  LOOP
    -- 计算正确的积分余额(所有交易的总和)
    SELECT COALESCE(SUM(amount), 0)
    INTO v_correct_balance
    FROM public.point_transactions
    WHERE user_id = v_user.user_id;

    -- 获取当前 profiles 表中的积分
    SELECT COALESCE(points, 0)
    INTO v_current_balance
    FROM public.profiles
    WHERE id = v_user.user_id;

    -- 如果不一致,更新为正确的值
    IF v_correct_balance != v_current_balance THEN
      UPDATE public.profiles
      SET points = v_correct_balance
      WHERE id = v_user.user_id;

      RAISE NOTICE '用户 % 积分已修复: % -> %', v_user.user_id, v_current_balance, v_correct_balance;
    ELSE
      RAISE NOTICE '用户 % 积分正确: %', v_user.user_id, v_correct_balance;
    END IF;
  END LOOP;

  RAISE NOTICE '积分修复完成!';
END $$;

-- 4. 验证修复结果
DO $$
DECLARE
  v_user RECORD;
  v_transaction_sum INTEGER;
  v_profile_points INTEGER;
  v_mismatch_count INTEGER := 0;
BEGIN
  RAISE NOTICE '===========================================';
  RAISE NOTICE '验证所有用户的积分一致性...';
  RAISE NOTICE '===========================================';

  FOR v_user IN
    SELECT DISTINCT user_id FROM public.point_transactions
  LOOP
    -- 计算交易记录的总和
    SELECT COALESCE(SUM(amount), 0)
    INTO v_transaction_sum
    FROM public.point_transactions
    WHERE user_id = v_user.user_id;

    -- 获取 profile 中的积分
    SELECT COALESCE(points, 0)
    INTO v_profile_points
    FROM public.profiles
    WHERE id = v_user.user_id;

    IF v_transaction_sum != v_profile_points THEN
      v_mismatch_count := v_mismatch_count + 1;
      RAISE WARNING '❌ 用户 % 积分不一致: transactions=%, profile=%', v_user.user_id, v_transaction_sum, v_profile_points;
    END IF;
  END LOOP;

  IF v_mismatch_count = 0 THEN
    RAISE NOTICE '✅ 所有用户积分数据一致!';
  ELSE
    RAISE WARNING '⚠️  发现 % 个用户积分不一致', v_mismatch_count;
  END IF;

  RAISE NOTICE '===========================================';
END $$;
