-- ============================================================
-- 强制修复所有用户的数据 - 不管任何条件
-- ============================================================

DO $$
DECLARE
  v_user RECORD;
  v_user_number INTEGER;
  v_has_transactions BOOLEAN;
  v_total_points INTEGER;
BEGIN
  RAISE NOTICE '开始修复所有用户数据...';

  -- 遍历所有普通用户
  FOR v_user IN
    SELECT id, username, points, user_number, email
    FROM profiles
    WHERE role = 'user'
    ORDER BY created_at DESC
  LOOP
    RAISE NOTICE '处理用户: %', v_user.username;

    -- 1. 修复用户编号
    IF v_user.user_number IS NULL THEN
      v_user_number := nextval('user_number_seq');

      UPDATE profiles
      SET user_number = v_user_number
      WHERE id = v_user.id;

      RAISE NOTICE '  ✅ 分配用户编号: %', v_user_number;
    ELSE
      RAISE NOTICE '  ✓ 已有用户编号: %', v_user.user_number;
    END IF;

    -- 2. 检查是否有交易记录
    SELECT EXISTS (
      SELECT 1 FROM point_transactions WHERE user_id = v_user.id
    ) INTO v_has_transactions;

    IF NOT v_has_transactions THEN
      -- 没有交易记录，创建注册奖励
      RAISE NOTICE '  创建注册奖励交易记录...';

      PERFORM record_point_transaction(
        v_user.id,
        100,
        'registration',
        '注册赠送积分 +100积分',
        NULL,
        NULL,
        jsonb_build_object('source', 'manual_fix')
      );

      RAISE NOTICE '  ✅ 已创建注册奖励';
    ELSE
      -- 有交易记录，重新计算积分
      SELECT COALESCE(SUM(amount), 0) INTO v_total_points
      FROM point_transactions
      WHERE user_id = v_user.id;

      IF v_total_points != v_user.points THEN
        UPDATE profiles
        SET points = v_total_points
        WHERE id = v_user.id;

        RAISE NOTICE '  ✅ 修正积分: % -> %', v_user.points, v_total_points;
      ELSE
        RAISE NOTICE '  ✓ 积分正确: %', v_user.points;
      END IF;
    END IF;

    RAISE NOTICE '';
  END LOOP;

  RAISE NOTICE '修复完成！';
END $$;

-- 验证结果
SELECT
  username,
  points as "积分",
  user_number as "编号",
  (SELECT COUNT(*) FROM point_transactions WHERE user_id = profiles.id) as "交易数",
  created_at as "注册时间"
FROM profiles
WHERE role = 'user'
ORDER BY created_at DESC
LIMIT 10;

SELECT '✅ 所有用户数据已强制修复！' as status;
