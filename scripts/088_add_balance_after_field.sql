-- ============================================
-- 文件: 088_add_balance_after_field.sql
-- 描述: 为 point_transactions 表添加 balance_after 字段(如果缺失)
-- 作者: System
-- 创建日期: 2025-11-19
-- ============================================

-- 说明:
-- 生产环境可能缺少 balance_after 字段,导致积分记录页面显示余额为空
-- 此脚本会:
-- 1. 添加 balance_after 字段(如果不存在)
-- 2. 重新计算所有现有记录的 balance_after 值
-- 3. 验证数据正确性

BEGIN;

-- ============================================
-- 第一步: 添加 balance_after 字段(如果不存在)
-- ============================================

-- 检查字段是否存在
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'point_transactions'
      AND column_name = 'balance_after'
  ) THEN
    -- 字段不存在,添加它
    ALTER TABLE point_transactions
    ADD COLUMN balance_after INTEGER NOT NULL DEFAULT 0;

    RAISE NOTICE '✅ 已添加 balance_after 字段';
  ELSE
    RAISE NOTICE '✅ balance_after 字段已存在';
  END IF;
END $$;

-- 添加字段注释
COMMENT ON COLUMN point_transactions.balance_after IS '交易后的积分余额';

-- ============================================
-- 第二步: 重新计算所有记录的 balance_after
-- ============================================

-- 按用户和时间顺序重新计算
DO $$
DECLARE
  v_user_id UUID;
  v_transaction_record RECORD;
  v_running_balance INTEGER;
BEGIN
  RAISE NOTICE '🔄 开始重新计算 balance_after...';

  -- 遍历所有用户
  FOR v_user_id IN
    SELECT DISTINCT user_id
    FROM point_transactions
    ORDER BY user_id
  LOOP
    v_running_balance := 0;

    -- 按时间顺序遍历该用户的所有交易
    FOR v_transaction_record IN
      SELECT id, amount
      FROM point_transactions
      WHERE user_id = v_user_id
      ORDER BY created_at ASC, id ASC
    LOOP
      -- 计算交易后余额
      v_running_balance := v_running_balance + v_transaction_record.amount;

      -- 更新 balance_after
      UPDATE point_transactions
      SET balance_after = v_running_balance
      WHERE id = v_transaction_record.id;
    END LOOP;

    RAISE NOTICE '✅ 已处理用户 % 的交易记录', v_user_id;
  END LOOP;

  RAISE NOTICE '✅ 所有用户的 balance_after 已重新计算完成';
END $$;

-- ============================================
-- 第三步: 验证数据正确性
-- ============================================

-- 检查每个用户的最后余额是否与 profiles.points 一致
DO $$
DECLARE
  v_mismatch_count INTEGER;
  v_total_users INTEGER;
BEGIN
  RAISE NOTICE '🔍 验证数据正确性...';

  -- 统计不一致的用户数
  SELECT COUNT(*) INTO v_mismatch_count
  FROM (
    SELECT
      u.id,
      p.points as profile_points,
      COALESCE(
        (SELECT balance_after
         FROM point_transactions
         WHERE user_id = u.id
         ORDER BY created_at DESC, id DESC
         LIMIT 1),
        0
      ) as last_transaction_balance
    FROM auth.users u
    INNER JOIN profiles p ON u.id = p.id
    WHERE p.points != COALESCE(
      (SELECT balance_after
       FROM point_transactions
       WHERE user_id = u.id
       ORDER BY created_at DESC, id DESC
       LIMIT 1),
      0
    )
  ) mismatches;

  -- 统计总用户数
  SELECT COUNT(*) INTO v_total_users
  FROM profiles;

  RAISE NOTICE '===========================================';
  RAISE NOTICE '验证结果:';
  RAISE NOTICE '总用户数: %', v_total_users;
  RAISE NOTICE '余额不一致用户数: %', v_mismatch_count;
  RAISE NOTICE '===========================================';

  IF v_mismatch_count > 0 THEN
    RAISE WARNING '发现 % 个用户的余额不一致，需要进一步检查', v_mismatch_count;
    RAISE NOTICE '可能原因:';
    RAISE NOTICE '1. 用户没有任何积分交易记录';
    RAISE NOTICE '2. profiles.points 被直接修改而没有记录交易';
  ELSE
    RAISE NOTICE '✓ 所有用户的余额数据一致!';
  END IF;
END $$;

-- ============================================
-- 第四步: 显示示例数据
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '===========================================';
  RAISE NOTICE '示例交易记录 (最近10条):';
  RAISE NOTICE '===========================================';
END $$;

SELECT
  pt.created_at AS "时间",
  pt.type AS "类型",
  pt.amount AS "变动",
  pt.balance_after AS "余额",
  p.points AS "当前积分"
FROM point_transactions pt
INNER JOIN profiles p ON pt.user_id = p.id
ORDER BY pt.created_at DESC
LIMIT 10;

COMMIT;

-- ============================================
-- 脚本执行完成
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '===========================================';
  RAISE NOTICE '✅ 脚本执行完成!';
  RAISE NOTICE '===========================================';
END $$;
