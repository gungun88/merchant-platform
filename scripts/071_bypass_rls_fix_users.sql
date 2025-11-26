-- ============================================================
-- 绕过 RLS 策略修复用户数据
-- ============================================================

-- 步骤 1: 查看触发器状态
SELECT '=== 1. 检查触发器 ===' as step;

SELECT
  trigger_name,
  event_object_table,
  action_timing,
  event_manipulation
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created';

-- 步骤 2: 检查序列
SELECT '=== 2. 检查序列 ===' as step;

SELECT last_value as current_seq_value FROM user_number_seq;

-- 步骤 3: 查看所有需要修复的用户
SELECT '=== 3. 需要修复的用户 ===' as step;

SELECT
  username,
  points,
  user_number,
  email,
  created_at
FROM profiles
WHERE (user_number IS NULL OR points = 0)
  AND role = 'user'
ORDER BY created_at DESC;

-- 步骤 4: 使用 SECURITY DEFINER 函数修复（绕过 RLS）
CREATE OR REPLACE FUNCTION fix_users_bypass_rls()
RETURNS TABLE(
  username TEXT,
  old_points INTEGER,
  new_points INTEGER,
  old_user_number INTEGER,
  new_user_number INTEGER,
  status TEXT
)
SECURITY DEFINER  -- 关键：以函数所有者权限执行，绕过 RLS
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_user RECORD;
  v_user_number INTEGER;
  v_has_transactions BOOLEAN;
BEGIN
  -- 遍历所有需要修复的用户
  FOR v_user IN
    SELECT id, username, points, user_number
    FROM profiles
    WHERE (user_number IS NULL OR points = 0)
      AND role = 'user'
    ORDER BY created_at DESC
  LOOP
    -- 修复用户编号
    IF v_user.user_number IS NULL THEN
      v_user_number := nextval('user_number_seq');

      UPDATE profiles
      SET user_number = v_user_number,
          updated_at = NOW()
      WHERE id = v_user.id;
    ELSE
      v_user_number := v_user.user_number;
    END IF;

    -- 检查是否已有交易记录
    SELECT EXISTS (
      SELECT 1 FROM point_transactions WHERE user_id = v_user.id
    ) INTO v_has_transactions;

    -- 如果积分为 0 且没有交易记录，创建注册奖励
    IF v_user.points = 0 AND NOT v_has_transactions THEN
      -- 创建交易记录
      INSERT INTO point_transactions (
        user_id,
        amount,
        balance_after,
        type,
        description,
        created_at
      ) VALUES (
        v_user.id,
        100,
        100,
        'registration',
        '注册赠送积分 +100积分',
        NOW()
      );

      -- 更新积分
      UPDATE profiles
      SET points = 100,
          updated_at = NOW()
      WHERE id = v_user.id;

      -- 返回修复结果
      RETURN QUERY SELECT
        v_user.username,
        v_user.points,
        100,
        v_user.user_number,
        v_user_number,
        '✅ 已修复'::TEXT;
    ELSE
      -- 只修复了编号
      RETURN QUERY SELECT
        v_user.username,
        v_user.points,
        v_user.points,
        v_user.user_number,
        v_user_number,
        '✅ 仅修复编号'::TEXT;
    END IF;
  END LOOP;
END;
$$;

-- 步骤 5: 执行修复
SELECT '=== 4. 执行修复 ===' as step;

SELECT * FROM fix_users_bypass_rls();

-- 步骤 6: 验证修复结果
SELECT '=== 5. 验证结果 ===' as step;

SELECT
  username,
  points as "积分",
  user_number as "编号",
  (SELECT COUNT(*) FROM point_transactions WHERE user_id = profiles.id) as "交易数",
  email,
  created_at as "注册时间"
FROM profiles
WHERE username IN ('0s7lu', 'x3yo8', 'i2md9')
ORDER BY created_at DESC;

-- 步骤 7: 检查 profiles 表的 RLS 策略
SELECT '=== 6. 检查 RLS 策略 ===' as step;

SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'profiles'
ORDER BY policyname;

SELECT '✅ 修复完成！' as status;
