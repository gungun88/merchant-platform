-- 检查当前触发器的状态和定义

-- 1. 检查触发器是否存在
SELECT
  trigger_name,
  event_object_table,
  action_timing,
  event_manipulation
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created';

-- 2. 查看触发器函数的完整定义
SELECT pg_get_functiondef('public.handle_new_user()'::regprocedure);

-- 3. 检查 user_number_seq 序列是否存在
SELECT
  sequence_name,
  last_value
FROM information_schema.sequences
WHERE sequence_name = 'user_number_seq';

-- 4. 手动测试：为 0s7lu 用户补充数据
DO $$
DECLARE
  v_user_id UUID;
  v_username TEXT := '0s7lu';
  v_user_number INTEGER;
BEGIN
  -- 获取用户ID
  SELECT id INTO v_user_id
  FROM profiles
  WHERE username = v_username;

  IF v_user_id IS NULL THEN
    RAISE NOTICE 'User % not found', v_username;
    RETURN;
  END IF;

  -- 分配用户编号
  v_user_number := nextval('user_number_seq');

  UPDATE profiles
  SET user_number = v_user_number
  WHERE id = v_user_id;

  RAISE NOTICE 'Assigned user_number % to %', v_user_number, v_username;

  -- 创建注册积分记录
  INSERT INTO point_transactions (
    user_id,
    amount,
    balance_after,
    type,
    description,
    created_at
  ) VALUES (
    v_user_id,
    100,
    100,
    'registration',
    '注册赠送积分 +100积分',
    NOW()
  );

  -- 更新用户积分
  UPDATE profiles
  SET points = 100
  WHERE id = v_user_id;

  RAISE NOTICE 'Created 100 points for %', v_username;
END $$;

-- 5. 验证 0s7lu 用户的数据
SELECT
  username,
  points,
  user_number,
  email,
  created_at
FROM profiles
WHERE username = '0s7lu';

SELECT '✅ 检查和修复完成！' as status;
