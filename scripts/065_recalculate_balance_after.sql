-- ============================================================
-- 重新计算所有交易记录的 balance_after 字段
-- ============================================================
-- 问题描述:
-- 交易记录中的 balance_after 字段保存的是历史余额
-- 由于注册bug，这些余额数据不正确，需要重新计算
-- ============================================================

-- 步骤 1: 创建临时函数来重新计算每个用户的交易余额
CREATE OR REPLACE FUNCTION recalculate_balance_after()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_user_id UUID;
  v_transaction RECORD;
  v_running_balance INTEGER;
BEGIN
  -- 遍历所有用户
  FOR v_user_id IN
    SELECT DISTINCT user_id FROM point_transactions
  LOOP
    v_running_balance := 0;

    -- 按时间顺序处理该用户的所有交易
    FOR v_transaction IN
      SELECT id, amount
      FROM point_transactions
      WHERE user_id = v_user_id
      ORDER BY created_at ASC, id ASC
    LOOP
      -- 累加余额
      v_running_balance := v_running_balance + v_transaction.amount;

      -- 更新该交易的 balance_after
      UPDATE point_transactions
      SET balance_after = v_running_balance
      WHERE id = v_transaction.id;
    END LOOP;

    RAISE NOTICE 'Recalculated balance for user: %, final balance: %', v_user_id, v_running_balance;
  END LOOP;
END;
$$;

-- 步骤 2: 执行重新计算
SELECT recalculate_balance_after();

-- 步骤 3: 验证结果 - 检查用户的 profiles.points 是否与最后一笔交易的 balance_after 一致
WITH user_balance_check AS (
  SELECT
    p.id as user_id,
    p.username,
    p.points as profile_points,
    (
      SELECT pt.balance_after
      FROM point_transactions pt
      WHERE pt.user_id = p.id
      ORDER BY pt.created_at DESC, pt.id DESC
      LIMIT 1
    ) as last_transaction_balance
  FROM profiles p
  WHERE p.role = 'user'
)
SELECT
  username as "用户名",
  profile_points as "当前积分",
  last_transaction_balance as "最后交易余额",
  CASE
    WHEN profile_points = last_transaction_balance THEN '✅ 一致'
    ELSE '❌ 不一致'
  END as "状态"
FROM user_balance_check
ORDER BY username;

-- 步骤 4: 清理临时函数
DROP FUNCTION recalculate_balance_after();

-- ============================================================
-- 执行完成！
-- ============================================================
-- 修复说明:
-- 1. ✅ 按时间顺序重新计算每笔交易后的余额
-- 2. ✅ 更新所有交易记录的 balance_after 字段
-- 3. ✅ 验证用户当前积分与最后一笔交易余额是否一致
-- ============================================================

SELECT '✅ 所有交易记录的余额已重新计算！' as status;
