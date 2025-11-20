-- ============================================
-- 文件: 090_recalculate_balance_after.sql
-- 描述: 重新计算所有积分交易记录的 balance_after 字段
-- 作者: System
-- 创建日期: 2025-11-20
-- ============================================

-- 说明:
-- 由于之前的代码调用顺序错误,导致 balance_after 计算不准确
-- 此脚本会按时间顺序重新计算每个用户的所有交易记录的余额

BEGIN;

-- ============================================
-- 第一步: 备份原数据（可选，生产环境建议执行）
-- ============================================

-- 如果已存在备份表，先删除
DROP TABLE IF EXISTS point_transactions_backup_before_recalc;

-- 创建备份
CREATE TABLE point_transactions_backup_before_recalc AS
SELECT * FROM point_transactions;

RAISE NOTICE '✅ 已备份原数据到 point_transactions_backup_before_recalc 表';

-- ============================================
-- 第二步: 重新计算所有记录的 balance_after
-- ============================================

DO $$
DECLARE
  v_user_id UUID;
  v_transaction_record RECORD;
  v_running_balance INTEGER;
  v_total_users INTEGER := 0;
  v_total_records INTEGER := 0;
BEGIN
  RAISE NOTICE '===========================================';
  RAISE NOTICE '🔄 开始重新计算所有用户的 balance_after...';
  RAISE NOTICE '===========================================';

  -- 遍历所有用户
  FOR v_user_id IN
    SELECT DISTINCT user_id
    FROM point_transactions
    ORDER BY user_id
  LOOP
    v_running_balance := 0;
    v_total_users := v_total_users + 1;

    -- 按时间顺序遍历该用户的所有交易
    FOR v_transaction_record IN
      SELECT id, amount, created_at
      FROM point_transactions
      WHERE user_id = v_user_id
      ORDER BY created_at ASC, id ASC
    LOOP
      -- 累加余额
      v_running_balance := v_running_balance + v_transaction_record.amount;

      -- 更新该记录的 balance_after
      UPDATE point_transactions
      SET balance_after = v_running_balance
      WHERE id = v_transaction_record.id;

      v_total_records := v_total_records + 1;
    END LOOP;

    -- 每处理10个用户输出一次进度
    IF v_total_users % 10 = 0 THEN
      RAISE NOTICE '进度: 已处理 % 个用户', v_total_users;
    END IF;
  END LOOP;

  RAISE NOTICE '===========================================';
  RAISE NOTICE '✅ 重新计算完成!';
  RAISE NOTICE '   处理用户数: %', v_total_users;
  RAISE NOTICE '   处理记录数: %', v_total_records;
  RAISE NOTICE '===========================================';
END $$;

-- ============================================
-- 第三步: 验证数据正确性
-- ============================================

DO $$
DECLARE
  v_mismatch_count INTEGER;
  v_total_users INTEGER;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '🔍 验证数据正确性...';
  RAISE NOTICE '';

  -- 统计总用户数
  SELECT COUNT(DISTINCT user_id) INTO v_total_users
  FROM point_transactions;

  -- 统计不一致的用户数（最后一笔交易的余额应该等于 profiles.points）
  WITH last_transaction AS (
    SELECT DISTINCT ON (user_id)
      user_id,
      balance_after
    FROM point_transactions
    ORDER BY user_id, created_at DESC, id DESC
  )
  SELECT COUNT(*) INTO v_mismatch_count
  FROM last_transaction lt
  INNER JOIN profiles p ON p.id = lt.user_id
  WHERE lt.balance_after != p.points;

  IF v_mismatch_count > 0 THEN
    RAISE WARNING '⚠️  发现 % 个用户的余额数据不一致（共 % 个用户）', v_mismatch_count, v_total_users;
    RAISE NOTICE '';
    RAISE NOTICE '不一致的用户列表:';
    RAISE NOTICE '-------------------------------------------';

    -- 显示不一致的用户详情
    PERFORM
      RAISE NOTICE '用户ID: % | 交易余额: % | 实际积分: % | 差异: %',
        p.id,
        lt.balance_after,
        p.points,
        (p.points - lt.balance_after)
    FROM (
      SELECT DISTINCT ON (user_id)
        user_id,
        balance_after
      FROM point_transactions
      ORDER BY user_id, created_at DESC, id DESC
    ) lt
    INNER JOIN profiles p ON p.id = lt.user_id
    WHERE lt.balance_after != p.points
    LIMIT 10;

    IF v_mismatch_count > 10 THEN
      RAISE NOTICE '... 还有 % 个用户未显示', (v_mismatch_count - 10);
    END IF;

    RAISE NOTICE '-------------------------------------------';
    RAISE NOTICE '';
    RAISE NOTICE '💡 可能原因:';
    RAISE NOTICE '   1. profiles.points 字段被直接修改过';
    RAISE NOTICE '   2. 部分交易记录缺失';
    RAISE NOTICE '   3. 需要手动同步数据';
  ELSE
    RAISE NOTICE '✅ 所有用户的余额数据一致! (共 % 个用户)', v_total_users;
  END IF;
END $$;

-- ============================================
-- 第四步: 显示统计信息
-- ============================================

DO $$
DECLARE
  v_total_transactions INTEGER;
  v_positive_count INTEGER;
  v_negative_count INTEGER;
  v_total_earned BIGINT;
  v_total_spent BIGINT;
BEGIN
  -- 统计交易记录数
  SELECT COUNT(*) INTO v_total_transactions FROM point_transactions;
  SELECT COUNT(*) INTO v_positive_count FROM point_transactions WHERE amount > 0;
  SELECT COUNT(*) INTO v_negative_count FROM point_transactions WHERE amount < 0;
  SELECT COALESCE(SUM(amount), 0) INTO v_total_earned FROM point_transactions WHERE amount > 0;
  SELECT COALESCE(ABS(SUM(amount)), 0) INTO v_total_spent FROM point_transactions WHERE amount < 0;

  RAISE NOTICE '';
  RAISE NOTICE '===========================================';
  RAISE NOTICE '📊 积分交易统计';
  RAISE NOTICE '===========================================';
  RAISE NOTICE '总交易记录数: %', v_total_transactions;
  RAISE NOTICE '收入记录数: % (%.1f%%)', v_positive_count, (v_positive_count::FLOAT / v_total_transactions * 100);
  RAISE NOTICE '支出记录数: % (%.1f%%)', v_negative_count, (v_negative_count::FLOAT / v_total_transactions * 100);
  RAISE NOTICE '-------------------------------------------';
  RAISE NOTICE '累计获得积分: % 分', v_total_earned;
  RAISE NOTICE '累计消耗积分: % 分', v_total_spent;
  RAISE NOTICE '净积分: % 分', (v_total_earned - v_total_spent);
  RAISE NOTICE '===========================================';
END $$;

-- ============================================
-- 第五步: 显示示例数据
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '===========================================';
  RAISE NOTICE '📝 示例交易记录 (最近10条):';
  RAISE NOTICE '===========================================';
END $$;

SELECT
  TO_CHAR(pt.created_at, 'YYYY-MM-DD HH24:MI:SS') AS "时间",
  pt.type AS "类型",
  pt.description AS "描述",
  pt.amount AS "变动",
  pt.balance_after AS "余额",
  p.points AS "当前积分"
FROM point_transactions pt
LEFT JOIN profiles p ON p.id = pt.user_id
ORDER BY pt.created_at DESC
LIMIT 10;

COMMIT;

-- ============================================
-- 脚本执行完成
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '===========================================';
  RAISE NOTICE '✅ 脚本执行完成!';
  RAISE NOTICE '===========================================';
  RAISE NOTICE '';
  RAISE NOTICE '下一步操作:';
  RAISE NOTICE '1. 检查上方的验证结果';
  RAISE NOTICE '2. 刷新前端页面查看积分记录';
  RAISE NOTICE '3. 确认余额显示正确';
  RAISE NOTICE '';
  RAISE NOTICE '如需恢复原数据，执行:';
  RAISE NOTICE 'DROP TABLE point_transactions;';
  RAISE NOTICE 'ALTER TABLE point_transactions_backup_before_recalc RENAME TO point_transactions;';
  RAISE NOTICE '';
END $$;
