-- =============================================
-- 紧急回滚和修复积分
-- 创建时间: 2025-10-30
-- 说明: 回滚错误的修复,重建正确的交易记录
-- =============================================

-- 1. 先查看当前所有用户的积分情况
SELECT
  u.id,
  u.email,
  p.points as current_points,
  COALESCE(SUM(pt.amount), 0) as sum_of_transactions,
  p.points - COALESCE(SUM(pt.amount), 0) as difference
FROM auth.users u
LEFT JOIN profiles p ON u.id = p.id
LEFT JOIN point_transactions pt ON u.id = pt.user_id
GROUP BY u.id, u.email, p.points
HAVING p.points - COALESCE(SUM(pt.amount), 0) != 0 OR p.points < 0
ORDER BY p.points;

-- 2. 对于每个积分异常的用户,创建系统调整记录来补齐差额
DO $$
DECLARE
  v_user_record RECORD;
  v_transaction_sum INTEGER;
  v_difference INTEGER;
  v_correct_points INTEGER;
BEGIN
  FOR v_user_record IN
    SELECT
      u.id as user_id,
      u.email,
      p.points as current_points
    FROM auth.users u
    JOIN profiles p ON u.id = p.id
  LOOP
    -- 计算该用户所有交易记录的总和
    SELECT COALESCE(SUM(amount), 0) INTO v_transaction_sum
    FROM point_transactions
    WHERE user_id = v_user_record.user_id;

    v_difference := v_user_record.current_points - v_transaction_sum;

    -- 如果当前积分是负数,说明被错误修复了
    IF v_user_record.current_points < 0 THEN
      -- 找出最后一条正常的交易记录的 balance_after
      SELECT balance_after INTO v_correct_points
      FROM point_transactions
      WHERE user_id = v_user_record.user_id
        AND balance_after > 0
      ORDER BY created_at DESC, id DESC
      LIMIT 1;

      -- 如果找不到正常记录,使用0作为基础
      IF v_correct_points IS NULL THEN
        v_correct_points := 0;
      END IF;

      -- 计算需要恢复多少积分
      v_difference := v_correct_points - v_transaction_sum;

      IF v_difference != 0 THEN
        RAISE NOTICE '用户 % (%) 需要系统调整: 交易总和=%, 应有积分=%, 差额=%',
          v_user_record.email, v_user_record.user_id, v_transaction_sum, v_correct_points, v_difference;

        -- 创建系统调整记录
        INSERT INTO point_transactions (
          user_id,
          amount,
          balance_after,
          type,
          description,
          metadata
        ) VALUES (
          v_user_record.user_id,
          v_difference,
          v_correct_points,
          'system_adjustment',
          '系统积分调整 (修复错误)',
          jsonb_build_object(
            'reason', 'fix_balance_error',
            'previous_balance', v_user_record.current_points,
            'transaction_sum', v_transaction_sum
          )
        );

        -- 更新 profiles 表
        UPDATE profiles
        SET points = v_correct_points
        WHERE id = v_user_record.user_id;

        RAISE NOTICE '已修复用户 % 的积分: % -> %',
          v_user_record.email, v_user_record.current_points, v_correct_points;
      END IF;

    -- 如果只是交易记录和 profiles 不一致(但不是负数)
    ELSIF v_difference != 0 THEN
      RAISE NOTICE '用户 % (%) 交易记录与积分不一致: 当前积分=%, 交易总和=%, 差额=%',
        v_user_record.email, v_user_record.user_id, v_user_record.current_points, v_transaction_sum, v_difference;

      -- 创建系统调整记录来补齐差额
      INSERT INTO point_transactions (
        user_id,
        amount,
        balance_after,
        type,
        description,
        metadata
      ) VALUES (
        v_user_record.user_id,
        v_difference,
        v_user_record.current_points,
        'system_adjustment',
        '系统积分调整 (补充缺失记录)',
        jsonb_build_object(
          'reason', 'fill_missing_transaction',
          'transaction_sum', v_transaction_sum
        )
      );

      RAISE NOTICE '已为用户 % 补充交易记录,差额: %', v_user_record.email, v_difference;
    END IF;
  END LOOP;

  RAISE NOTICE '积分修复完成!';
END $$;

-- 3. 重新计算所有用户的 balance_after
DO $$
DECLARE
  v_user_record RECORD;
  v_transaction_record RECORD;
  v_running_balance INTEGER;
BEGIN
  FOR v_user_record IN
    SELECT DISTINCT user_id
    FROM public.point_transactions
    ORDER BY user_id
  LOOP
    v_running_balance := 0;

    FOR v_transaction_record IN
      SELECT id, amount, created_at
      FROM public.point_transactions
      WHERE user_id = v_user_record.user_id
      ORDER BY created_at ASC, id ASC
    LOOP
      v_running_balance := v_running_balance + v_transaction_record.amount;

      UPDATE public.point_transactions
      SET balance_after = v_running_balance
      WHERE id = v_transaction_record.id;
    END LOOP;
  END LOOP;
END $$;

-- =============================================
-- 验证修复结果
-- =============================================

SELECT
  u.email,
  p.points as 当前积分,
  (SELECT balance_after FROM point_transactions WHERE user_id = u.id ORDER BY created_at DESC, id DESC LIMIT 1) as 最后交易余额,
  (SELECT SUM(amount) FROM point_transactions WHERE user_id = u.id) as 交易总和,
  CASE
    WHEN p.points = (SELECT balance_after FROM point_transactions WHERE user_id = u.id ORDER BY created_at DESC, id DESC LIMIT 1)
    THEN '✓ 正常'
    ELSE '✗ 异常'
  END as 状态
FROM auth.users u
JOIN profiles p ON u.id = p.id
WHERE EXISTS (SELECT 1 FROM point_transactions WHERE user_id = u.id)
ORDER BY p.points DESC;
