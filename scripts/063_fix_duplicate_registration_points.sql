-- ============================================================
-- 修复注册积分重复发放bug
-- ============================================================
-- 问题描述:
-- 1. 创建 profile 时设置 points = v_register_points (100)
-- 2. 然后又调用 record_point_transaction 增加积分 (再+100)
-- 3. 导致用户实际获得 200 积分,但交易记录只显示 100
-- ============================================================

-- 步骤 1: 修复触发器函数
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
  -- 检查 profile 是否已存在
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = new.id
  ) INTO v_profile_exists;

  IF v_profile_exists THEN
    RAISE NOTICE 'Profile already exists for user %, skipping', new.id;
    RETURN new;
  END IF;

  -- 从系统设置获取注册积分
  SELECT register_points INTO v_register_points
  FROM system_settings
  WHERE id = '00000000-0000-0000-0000-000000000001'
  LIMIT 1;

  IF v_register_points IS NULL THEN
    v_register_points := 100;
  END IF;

  -- 生成邀请码
  BEGIN
    v_invitation_code := generate_invitation_code();
  EXCEPTION WHEN OTHERS THEN
    v_invitation_code := substring(md5(random()::text || new.id::text) from 1 for 8);
  END;

  -- 创建 profile（初始积分设为 0，稍后通过交易记录增加）
  BEGIN
    INSERT INTO public.profiles (
      id,
      username,
      email,
      points,  -- 初始设为 0
      is_merchant,
      invitation_code,
      role,
      consecutive_checkin_days,
      report_count,
      is_banned,
      login_failed_attempts,
      created_at,
      updated_at
    )
    VALUES (
      new.id,
      COALESCE(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1)),
      new.email,
      0,  -- 初始设为 0，稍后通过 record_point_transaction 增加
      false,
      v_invitation_code,
      'user',
      0,
      0,
      false,
      0,
      NOW(),
      NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      email = EXCLUDED.email,
      updated_at = NOW();

    RAISE NOTICE 'Profile created/updated for user %', new.id;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Failed to create profile: %', SQLERRM;
    RETURN new;
  END;

  -- 记录积分交易（这会自动增加用户积分）
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
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Failed to record points: %', SQLERRM;
  END;

  -- 发送欢迎通知
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
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Failed to send notification: %', SQLERRM;
  END;

  RETURN new;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Unexpected error in handle_new_user: %', SQLERRM;
  RETURN new;
END;
$$;

-- 步骤 2: 更新注释
COMMENT ON FUNCTION public.handle_new_user IS '处理新用户注册：创建profile（初始0积分）、通过交易记录增加注册积分、发送通知';

-- 步骤 3: 验证触发器
SELECT
  trigger_name,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE event_object_schema = 'auth'
  AND event_object_table = 'users'
  AND trigger_name = 'on_auth_user_created';

-- ============================================================
-- 执行完成！
-- ============================================================
-- 修复内容:
-- 1. ✅ 创建 profile 时初始积分设为 0
-- 2. ✅ 通过 record_point_transaction 正确增加注册奖励积分
-- 3. ✅ 积分交易记录和用户积分余额现在能正确对应了
-- ============================================================

SELECT '✅ 注册积分重复发放bug已修复！' as status;
