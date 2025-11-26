-- ====================================================================
-- 修复新用户注册问题 - 确保用户编号和积分正确分配
-- 问题: 新注册用户没有用户编号和积分
-- 原因: handle_new_user 触发器没有设置 user_number，或触发器执行失败
-- ====================================================================

-- ============================================================
-- 第一步: 检查当前触发器状态
-- ============================================================
SELECT
  '=== 检查触发器 ===' AS info,
  trigger_name,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND trigger_name IN ('on_auth_user_created', 'assign_user_number_on_insert')
ORDER BY trigger_name;

-- 检查序列状态
SELECT
  '=== 检查用户编号序列 ===' AS info,
  last_value AS current_value,
  is_called
FROM user_number_seq;

-- ============================================================
-- 第二步: 重新创建完整的注册触发器
-- ============================================================

-- 2.1 确保序列存在
CREATE SEQUENCE IF NOT EXISTS user_number_seq START WITH 100001;

-- 2.2 获取当前最大用户编号,更新序列
DO $$
DECLARE
  max_user_number INTEGER;
BEGIN
  SELECT COALESCE(MAX(user_number), 100000) INTO max_user_number FROM profiles;

  -- 设置序列为下一个可用编号
  PERFORM setval('user_number_seq', max_user_number + 1, false);

  RAISE NOTICE '✅ 序列已设置为: %', max_user_number + 1;
END $$;

-- 2.3 创建用户编号分配触发器函数
CREATE OR REPLACE FUNCTION assign_user_number()
RETURNS TRIGGER AS $$
BEGIN
  -- 如果 user_number 为空,自动分配下一个编号
  IF NEW.user_number IS NULL THEN
    NEW.user_number := nextval('user_number_seq');
    RAISE NOTICE '✅ 分配用户编号: %', NEW.user_number;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2.4 重新创建用户编号触发器
DROP TRIGGER IF EXISTS assign_user_number_on_insert ON profiles;
CREATE TRIGGER assign_user_number_on_insert
BEFORE INSERT ON profiles
FOR EACH ROW
EXECUTE FUNCTION assign_user_number();

-- 2.5 重新创建完整的注册触发器
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invitation_code TEXT;
  v_register_points INTEGER;
  v_profile_exists BOOLEAN;
  v_user_number INTEGER;
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '🔔 新用户注册触发器开始执行';
  RAISE NOTICE '用户ID: %', new.id;
  RAISE NOTICE '用户邮箱: %', new.email;
  RAISE NOTICE '========================================';

  -- 检查 profile 是否已存在
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = new.id
  ) INTO v_profile_exists;

  IF v_profile_exists THEN
    RAISE NOTICE '⚠️  Profile 已存在,跳过创建';
    RETURN new;
  END IF;

  -- 获取下一个用户编号
  v_user_number := nextval('user_number_seq');
  RAISE NOTICE '✅ 分配用户编号: %', v_user_number;

  -- 从系统设置获取注册奖励积分
  SELECT register_points INTO v_register_points
  FROM system_settings
  WHERE id = '00000000-0000-0000-0000-000000000001'
  LIMIT 1;

  -- 如果没有设置,使用默认值
  IF v_register_points IS NULL THEN
    v_register_points := 100;
    RAISE NOTICE '⚠️  使用默认注册积分: %', v_register_points;
  ELSE
    RAISE NOTICE '✅ 使用系统设置注册积分: %', v_register_points;
  END IF;

  -- 生成邀请码
  BEGIN
    v_invitation_code := generate_invitation_code();
    RAISE NOTICE '✅ 生成邀请码: %', v_invitation_code;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '⚠️  邀请码生成失败: %, 使用备用方案', SQLERRM;
    v_invitation_code := substring(md5(random()::text || new.id::text) from 1 for 8);
    RAISE NOTICE '✅ 使用备用邀请码: %', v_invitation_code;
  END;

  -- 插入用户 profile
  BEGIN
    INSERT INTO public.profiles (
      id,
      username,
      email,
      user_number,     -- ✅ 用户编号
      points,          -- ✅ 积分
      is_merchant,
      invitation_code,
      role,
      max_invitations,
      used_invitations,
      created_at,
      updated_at
    )
    VALUES (
      new.id,
      COALESCE(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1)),
      new.email,
      v_user_number,         -- ✅ 用户编号
      v_register_points,     -- ✅ 注册积分
      false,
      v_invitation_code,
      'user',
      5,    -- 默认最大邀请次数
      0,    -- 已使用邀请次数
      NOW(),
      NOW()
    )
    ON CONFLICT (id) DO NOTHING;

    RAISE NOTICE '✅ Profile 创建成功';
    RAISE NOTICE '   - 用户名: %', COALESCE(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1));
    RAISE NOTICE '   - 用户编号: %', v_user_number;
    RAISE NOTICE '   - 积分: %', v_register_points;
    RAISE NOTICE '   - 邀请码: %', v_invitation_code;

  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '❌ Profile 创建失败: %', SQLERRM;
    -- 不中止事务
  END;

  -- 记录注册积分交易
  BEGIN
    PERFORM record_point_transaction(
      new.id,
      v_register_points,
      'registration',
      '注册赠送积分 +' || v_register_points || '积分',
      NULL,
      NULL,
      jsonb_build_object('source', 'registration', 'user_number', v_user_number)
    );
    RAISE NOTICE '✅ 积分交易记录成功';
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '⚠️  积分交易记录失败: %', SQLERRM;
  END;

  -- 发送注册欢迎通知
  BEGIN
    PERFORM create_notification(
      new.id,
      'system',
      'registration',
      '欢迎加入',
      '注册成功！您已获得 ' || v_register_points || ' 积分奖励，您的用户编号是 NO.' || v_user_number || '，快去体验吧！',
      NULL,
      NULL,
      jsonb_build_object('points', v_register_points, 'user_number', v_user_number),
      'normal',
      NULL
    );
    RAISE NOTICE '✅ 欢迎通知发送成功';
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '⚠️  欢迎通知发送失败: %', SQLERRM;
  END;

  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ 新用户注册触发器执行完成';
  RAISE NOTICE '========================================';

  RETURN new;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '❌ 注册触发器执行失败: %', SQLERRM;
  RETURN new;
END;
$$;

-- 2.6 重新创建触发器
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

COMMENT ON FUNCTION public.handle_new_user IS '处理新用户注册：创建profile（含用户编号和积分）、发放注册积分、发送欢迎通知';

-- ============================================================
-- 第三步: 修复现有的没有用户编号和积分的用户
-- ============================================================

-- 3.1 找出有问题的用户
SELECT
  '=== 需要修复的用户 ===' AS info,
  id,
  username,
  user_number,
  points,
  created_at
FROM profiles
WHERE user_number IS NULL OR points IS NULL OR points = 0
ORDER BY created_at DESC
LIMIT 20;

-- 3.2 自动修复所有有问题的用户
DO $$
DECLARE
  profile_record RECORD;
  v_user_number INTEGER;
  v_points INTEGER := 100;  -- 默认注册积分
  fixed_count INTEGER := 0;
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '🔧 开始修复有问题的用户数据';
  RAISE NOTICE '========================================';

  -- 获取系统设置的注册积分
  SELECT register_points INTO v_points
  FROM system_settings
  WHERE id = '00000000-0000-0000-0000-000000000001'
  LIMIT 1;

  IF v_points IS NULL THEN
    v_points := 100;
  END IF;

  RAISE NOTICE '使用注册积分: %', v_points;

  -- 修复所有有问题的用户
  FOR profile_record IN
    SELECT id, username, user_number, points, created_at
    FROM profiles
    WHERE user_number IS NULL OR points IS NULL
    ORDER BY created_at ASC
  LOOP
    BEGIN
      -- 如果没有用户编号,分配一个
      IF profile_record.user_number IS NULL THEN
        v_user_number := nextval('user_number_seq');

        UPDATE profiles
        SET user_number = v_user_number
        WHERE id = profile_record.id;

        RAISE NOTICE '✅ 修复用户 % - 分配编号: %', profile_record.username, v_user_number;
      ELSE
        v_user_number := profile_record.user_number;
      END IF;

      -- 如果没有积分或积分为0,设置为注册积分
      IF profile_record.points IS NULL OR profile_record.points = 0 THEN
        UPDATE profiles
        SET points = v_points
        WHERE id = profile_record.id;

        RAISE NOTICE '✅ 修复用户 % - 设置积分: %', profile_record.username, v_points;

        -- 补充积分交易记录
        BEGIN
          PERFORM record_point_transaction(
            profile_record.id,
            v_points,
            'system_fix',
            '系统补发注册积分 +' || v_points || '积分',
            NULL,
            NULL,
            jsonb_build_object('source', 'system_fix', 'user_number', v_user_number)
          );
        EXCEPTION WHEN OTHERS THEN
          RAISE WARNING '⚠️  积分记录失败: %', SQLERRM;
        END;
      END IF;

      fixed_count := fixed_count + 1;

    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '❌ 修复用户 % 失败: %', profile_record.id, SQLERRM;
    END;
  END LOOP;

  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ 修复完成! 共修复 % 个用户', fixed_count;
  RAISE NOTICE '========================================';
END $$;

-- ============================================================
-- 第四步: 验证修复结果
-- ============================================================

-- 4.1 检查还有没有问题用户
SELECT
  '=== 验证修复结果 ===' AS info,
  COUNT(*) AS total_users,
  COUNT(CASE WHEN user_number IS NOT NULL THEN 1 END) AS has_user_number,
  COUNT(CASE WHEN points IS NOT NULL AND points > 0 THEN 1 END) AS has_points,
  COUNT(CASE WHEN user_number IS NULL OR points IS NULL OR points = 0 THEN 1 END) AS problem_users
FROM profiles;

-- 4.2 显示最近注册的用户
SELECT
  '=== 最近注册的用户 ===' AS info,
  username,
  user_number,
  points,
  role,
  created_at
FROM profiles
ORDER BY created_at DESC
LIMIT 10;

-- 完成提示
SELECT
  '✅ 新用户注册修复完成' AS status,
  '所有触发器已重建，现有用户数据已修复' AS description,
  NOW() AS executed_at;
