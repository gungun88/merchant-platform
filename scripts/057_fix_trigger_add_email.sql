-- ============================================================
-- 修复用户创建触发器 - 添加 email 字段
-- ============================================================
-- 问题: profiles 表的 email 字段可能是必填的，但触发器没有设置
-- 解决方案: 在创建 profile 时包含 email 字段
-- ============================================================

-- 创建正确的用户注册触发器函数
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

  -- 插入用户 profile (包含 email 字段!)
  BEGIN
    INSERT INTO public.profiles (
      id,
      username,
      email,           -- ✅ 添加 email 字段
      points,
      is_merchant,
      invitation_code,
      role,            -- ✅ 添加 role 字段
      created_at,
      updated_at
    )
    VALUES (
      new.id,
      COALESCE(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1)),
      new.email,       -- ✅ 使用认证用户的 email
      v_register_points,
      false,
      v_invitation_code,
      'user',          -- ✅ 默认角色为 user
      NOW(),
      NOW()
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

-- 确保触发器存在
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 更新函数注释
COMMENT ON FUNCTION public.handle_new_user IS '处理新用户注册：创建profile（含email）、发放注册积分、发送欢迎通知（带错误处理）';

-- ============================================================
-- 执行完成！
-- ============================================================
-- 修改内容:
-- 1. ✅ 在 INSERT 语句中添加了 email 字段
-- 2. ✅ 在 INSERT 语句中添加了 role 字段（默认为 'user'）
-- 3. ✅ 明确设置 created_at 和 updated_at
-- 4. ✅ 保留了所有错误处理机制
-- ============================================================
