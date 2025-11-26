-- ============================================================
-- 完整诊断和修复脚本
-- ============================================================

-- 步骤 1: 检查是否有数据异常
SELECT '=== 检查用户数据异常 ===' as step;

-- 检查没有用户编号的用户
SELECT
  'Missing user_number' as issue,
  COUNT(*) as count
FROM profiles
WHERE user_number IS NULL;

-- 检查积分为负数的用户
SELECT
  'Negative points' as issue,
  COUNT(*) as count
FROM profiles
WHERE points < 0;

-- 检查没有用户名的用户
SELECT
  'Missing username' as issue,
  COUNT(*) as count
FROM profiles
WHERE username IS NULL OR username = '';

-- 检查没有邮箱的用户
SELECT
  'Missing email' as issue,
  COUNT(*) as count
FROM profiles
WHERE email IS NULL OR email = '';

-- 步骤 2: 查看最近注册的用户详细信息
SELECT '=== 最近注册的用户 ===' as step;

SELECT
  username,
  email,
  points,
  user_number,
  created_at,
  (SELECT COUNT(*) FROM point_transactions WHERE user_id = profiles.id) as tx_count
FROM profiles
WHERE role = 'user'
ORDER BY created_at DESC
LIMIT 5;

-- 步骤 3: 检查是否有孤立的交易记录（user_id不存在）
SELECT '=== 检查孤立交易记录 ===' as step;

SELECT
  COUNT(*) as orphaned_transactions
FROM point_transactions pt
WHERE NOT EXISTS (
  SELECT 1 FROM profiles p WHERE p.id = pt.user_id
);

-- 步骤 4: 修复所有数据问题
SELECT '=== 开始修复数据 ===' as step;

DO $$
DECLARE
  v_user RECORD;
  v_user_number INTEGER;
BEGIN
  -- 4.1 修复缺失用户编号的用户
  FOR v_user IN
    SELECT id, username
    FROM profiles
    WHERE user_number IS NULL
  LOOP
    BEGIN
      v_user_number := nextval('user_number_seq');
      UPDATE profiles SET user_number = v_user_number WHERE id = v_user.id;
      RAISE NOTICE 'Fixed user_number for %: %', v_user.username, v_user_number;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Failed to fix user_number for %: %', v_user.username, SQLERRM;
    END;
  END LOOP;

  -- 4.2 修复缺失用户名的用户
  UPDATE profiles
  SET username = split_part(email, '@', 1)
  WHERE username IS NULL OR username = '';

  -- 4.3 修复积分为负数的用户
  UPDATE profiles
  SET points = 0
  WHERE points < 0;

  -- 4.4 为没有交易记录但有积分的用户创建初始记录
  FOR v_user IN
    SELECT id, username, points
    FROM profiles
    WHERE points > 0
      AND NOT EXISTS (
        SELECT 1 FROM point_transactions WHERE user_id = profiles.id
      )
  LOOP
    BEGIN
      INSERT INTO point_transactions (
        user_id,
        amount,
        balance_after,
        type,
        description,
        created_at
      ) VALUES (
        v_user.id,
        v_user.points,
        v_user.points,
        'registration',
        '注册赠送积分 +' || v_user.points || '积分',
        NOW()
      );
      RAISE NOTICE 'Created transaction for %', v_user.username;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Failed to create transaction for %: %', v_user.username, SQLERRM;
    END;
  END LOOP;

  -- 4.5 删除孤立的交易记录
  DELETE FROM point_transactions
  WHERE NOT EXISTS (
    SELECT 1 FROM profiles WHERE id = point_transactions.user_id
  );

  RAISE NOTICE '数据修复完成！';
END $$;

-- 步骤 5: 再次验证数据
SELECT '=== 验证修复结果 ===' as step;

SELECT
  username,
  points,
  user_number,
  (SELECT COUNT(*) FROM point_transactions WHERE user_id = profiles.id) as tx_count,
  CASE
    WHEN points < 0 THEN '❌ 积分为负'
    WHEN user_number IS NULL THEN '❌ 缺少编号'
    WHEN username IS NULL THEN '❌ 缺少用户名'
    ELSE '✅ 正常'
  END as status
FROM profiles
WHERE role = 'user'
ORDER BY created_at DESC
LIMIT 10;

SELECT '✅ 诊断和修复完成！' as status;
