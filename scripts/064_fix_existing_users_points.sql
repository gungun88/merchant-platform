-- ============================================================
-- 修复已有用户的积分余额
-- ============================================================
-- 问题描述:
-- 老用户注册时因为bug获得了 200 积分，但交易记录只显示 100
-- 需要将老用户的积分余额修正为与交易记录一致
-- ============================================================

-- 步骤 1: 创建临时函数来重新计算每个用户的正确积分
CREATE OR REPLACE FUNCTION fix_user_points()
RETURNS TABLE(
  user_id UUID,
  old_points INTEGER,
  calculated_points INTEGER,
  difference INTEGER,
  fixed BOOLEAN
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_user RECORD;
  v_calculated_points INTEGER;
  v_current_points INTEGER;
BEGIN
  -- 遍历所有用户
  FOR v_user IN
    SELECT p.id, p.points, p.username
    FROM profiles p
    WHERE p.role = 'user'  -- 只处理普通用户，不处理管理员
  LOOP
    -- 计算该用户的正确积分（根据交易记录）
    SELECT COALESCE(SUM(points), 0) INTO v_calculated_points
    FROM point_transactions
    WHERE user_id = v_user.id;

    v_current_points := v_user.points;

    -- 如果计算出的积分与当前积分不一致，则修复
    IF v_calculated_points != v_current_points THEN
      -- 更新用户积分
      UPDATE profiles
      SET
        points = v_calculated_points,
        updated_at = NOW()
      WHERE id = v_user.id;

      RAISE NOTICE 'Fixed user %: % -> %', v_user.username, v_current_points, v_calculated_points;

      -- 返回修复记录
      RETURN QUERY SELECT
        v_user.id,
        v_current_points,
        v_calculated_points,
        (v_current_points - v_calculated_points),
        true;
    ELSE
      -- 积分正确，不需要修复
      RETURN QUERY SELECT
        v_user.id,
        v_current_points,
        v_calculated_points,
        0,
        false;
    END IF;
  END LOOP;
END;
$$;

-- 步骤 2: 执行修复
SELECT
  user_id,
  old_points as "修复前积分",
  calculated_points as "正确积分",
  difference as "差异",
  CASE
    WHEN fixed THEN '✅ 已修复'
    ELSE '✓ 无需修复'
  END as "状态"
FROM fix_user_points()
ORDER BY difference DESC;

-- 步骤 3: 统计修复结果
WITH fix_stats AS (
  SELECT
    COUNT(*) as total_users,
    COUNT(*) FILTER (WHERE fixed = true) as fixed_users,
    SUM(difference) FILTER (WHERE fixed = true) as total_points_adjusted
  FROM fix_user_points()
)
SELECT
  total_users as "总用户数",
  fixed_users as "已修复用户数",
  (total_users - fixed_users) as "无需修复用户数",
  total_points_adjusted as "总调整积分"
FROM fix_stats;

-- 步骤 4: 清理临时函数
DROP FUNCTION fix_user_points();

-- ============================================================
-- 执行完成！
-- ============================================================
-- 修复说明:
-- 1. ✅ 根据 point_transactions 表重新计算每个用户的正确积分
-- 2. ✅ 将用户的 points 字段更新为正确的值
-- 3. ✅ 只修复积分不一致的用户，正确的用户跳过
-- 4. ✅ 输出详细的修复报告
-- ============================================================

SELECT '✅ 所有老用户的积分已修复！' as status;
