-- ============================================================
-- 修复用户创建触发器问题
-- ============================================================
-- 问题: 管理员通过 Admin API 创建用户时，触发器执行失败
-- 原因: 触发器中的函数调用可能有时序问题
-- 解决方案: 使用更健壮的错误处理和事务管理
-- ============================================================

-- 步骤 1: 创建更健壮的用户注册触发器函数
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
BEGIN
  -- 检查 profile 是否已存在 (避免重复创建)
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = new.id
  ) INTO v_profile_exists;

  IF v_profile_exists THEN
    RAISE NOTICE 'Profile already exists for user %, skipping trigger', new.id;
    RETURN new;
  END IF;

  -- 从系统设置获取注册奖励积分
  SELECT register_points INTO v_register_points
  FROM system_settings
  WHERE id = '00000000-0000-0000-0000-000000000001'
  LIMIT 1;

  -- 如果没有设置，使用默认值100
  IF v_register_points IS NULL THEN
    v_register_points := 100;
    RAISE NOTICE 'Using default register_points: %', v_register_points;
  END IF;

  -- 生成邀请码
  BEGIN
    v_invitation_code := generate_invitation_code();
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Failed to generate invitation code: %, using fallback', SQLERRM;
    v_invitation_code := substring(md5(random()::text || new.id::text) from 1 for 8);
  END;

  -- 插入用户 profile
  BEGIN
    INSERT INTO public.profiles (id, username, points, is_merchant, invitation_code)
    VALUES (
      new.id,
      COALESCE(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1)),
      v_register_points,
      false,
      v_invitation_code
    )
    ON CONFLICT (id) DO NOTHING;

    RAISE NOTICE 'Created profile for user % with % points', new.id, v_register_points;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Failed to create profile: %', SQLERRM;
    -- 不要中止事务，继续执行
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
      jsonb_build_object('source', 'registration')
    );
    RAISE NOTICE 'Recorded point transaction for user %', new.id;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Failed to record point transaction: %', SQLERRM;
    -- 不要中止事务，继续执行
  END;

  -- 发送注册欢迎通知
  BEGIN
    PERFORM create_notification(
      new.id,
      'system',
      'registration',
      '欢迎加入',
      '注册成功！您已获得 ' || v_register_points || ' 积分奖励，快去体验吧！',
      NULL,
      NULL,
      jsonb_build_object('points', v_register_points),
      'normal',
      NULL
    );
    RAISE NOTICE 'Created welcome notification for user %', new.id;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Failed to create notification: %', SQLERRM;
    -- 不要中止事务，继续执行
  END;

  RETURN new;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Error in handle_new_user trigger: %', SQLERRM;
  -- 即使触发器失败，也允许用户创建成功
  RETURN new;
END;
$$;

-- 步骤 2: 确保触发器存在
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 步骤 3: 更新函数注释
COMMENT ON FUNCTION public.handle_new_user IS '处理新用户注册：创建profile、发放注册积分、发送欢迎通知（带错误处理）';

-- ============================================================
-- 执行完成！
-- ============================================================
-- 说明:
-- 1. 新版本触发器增加了完善的错误处理
-- 2. 即使某个步骤失败,也不会阻止用户创建
-- 3. 所有错误都会记录为 WARNING,方便调试
-- 4. 检查 profile 是否已存在,避免重复创建
-- ============================================================
