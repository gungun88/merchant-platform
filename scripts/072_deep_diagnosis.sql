-- ============================================================
-- 深度诊断：查看实际的用户数据和权限问题
-- ============================================================

-- 1. 查看问题用户的完整原始数据
SELECT '=== 1. 问题用户的原始数据 ===' as step;

SELECT
  id,
  username,
  email,
  points,
  user_number,
  role,
  created_at
FROM profiles
WHERE username IN ('0s7lu', 'x3yo8', 'i2md9')
ORDER BY created_at DESC;

-- 2. 查看这些用户的交易记录
SELECT '=== 2. 交易记录 ===' as step;

SELECT
  p.username,
  pt.amount,
  pt.balance_after,
  pt.type,
  pt.description,
  pt.created_at
FROM point_transactions pt
JOIN profiles p ON p.id = pt.user_id
WHERE p.username IN ('0s7lu', 'x3yo8', 'i2md9')
ORDER BY p.username, pt.created_at;

-- 3. 检查 RLS 是否启用
SELECT '=== 3. RLS 状态 ===' as step;

SELECT
  schemaname,
  tablename,
  rowsecurity as "RLS启用"
FROM pg_tables
WHERE tablename IN ('profiles', 'point_transactions')
  AND schemaname = 'public';

-- 4. 查看当前执行的角色
SELECT '=== 4. 当前角色 ===' as step;

SELECT current_user as "当前用户", session_user as "会话用户";

-- 5. 直接以超级用户权限修复（最直接的方式）
SELECT '=== 5. 开始直接修复 ===' as step;

DO $$
DECLARE
  v_user RECORD;
  v_user_number INTEGER;
  v_fixed_count INTEGER := 0;
BEGIN
  -- 临时禁用触发器（避免重复操作）
  SET session_replication_role = 'replica';

  FOR v_user IN
    SELECT id, username, points, user_number
    FROM profiles
    WHERE username IN ('0s7lu', 'x3yo8', 'i2md9')
  LOOP
    RAISE NOTICE '处理用户: %', v_user.username;

    -- 1. 修复 user_number
    IF v_user.user_number IS NULL THEN
      v_user_number := nextval('user_number_seq');

      UPDATE profiles
      SET user_number = v_user_number
      WHERE id = v_user.id;

      RAISE NOTICE '  ✅ 分配编号: %', v_user_number;
    END IF;

    -- 2. 检查是否有交易记录
    IF NOT EXISTS (SELECT 1 FROM point_transactions WHERE user_id = v_user.id) THEN
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

      RAISE NOTICE '  ✅ 创建交易记录: 100积分';
    END IF;

    -- 3. 修复积分
    IF v_user.points = 0 THEN
      UPDATE profiles
      SET points = 100
      WHERE id = v_user.id;

      RAISE NOTICE '  ✅ 修复积分: 0 -> 100';
    END IF;

    v_fixed_count := v_fixed_count + 1;
  END LOOP;

  -- 恢复触发器
  SET session_replication_role = 'origin';

  RAISE NOTICE '';
  RAISE NOTICE '✅ 共修复 % 个用户', v_fixed_count;
END $$;

-- 6. 验证修复结果
SELECT '=== 6. 验证修复结果 ===' as step;

SELECT
  username as "用户名",
  points as "积分",
  user_number as "编号",
  (SELECT COUNT(*) FROM point_transactions WHERE user_id = profiles.id) as "交易数",
  email as "邮箱"
FROM profiles
WHERE username IN ('0s7lu', 'x3yo8', 'i2md9')
ORDER BY created_at DESC;

-- 7. 查看最新的交易记录
SELECT '=== 7. 最新交易记录 ===' as step;

SELECT
  p.username,
  pt.amount as "金额",
  pt.balance_after as "余额",
  pt.type as "类型",
  pt.description as "描述",
  pt.created_at as "时间"
FROM point_transactions pt
JOIN profiles p ON p.id = pt.user_id
WHERE p.username IN ('0s7lu', 'x3yo8', 'i2md9')
ORDER BY pt.created_at DESC;

SELECT '✅ 诊断和修复完成！' as status;
