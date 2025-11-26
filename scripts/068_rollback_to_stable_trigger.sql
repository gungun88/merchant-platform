-- ============================================================
-- 紧急回滚：恢复到稳定的触发器版本
-- ============================================================
-- 使用之前工作正常的 061_final_fix_user_trigger.sql 版本
-- 但添加 user_number 字段支持
-- ============================================================

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

  -- 获取用户编号（如果序列存在）
  BEGIN
    SELECT nextval('user_number_seq') INTO v_user_number;
  EXCEPTION WHEN OTHERS THEN
    v_user_number := NULL;
    RAISE NOTICE 'user_number_seq not found, skipping user_number';
  END;

  -- 创建 profile
  BEGIN
    INSERT INTO public.profiles (
      id,
      username,
      email,
      points,
      is_merchant,
      invitation_code,
      user_number,
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
      v_register_points,  -- 直接设置积分（旧版本的方式）
      false,
      v_invitation_code,
      v_user_number,
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

  -- 记录积分交易
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

COMMENT ON FUNCTION public.handle_new_user IS '处理新用户注册：创建profile（直接设置积分+记录交易）、发送通知';

SELECT '✅ 触发器已回滚到稳定版本！' as status;
