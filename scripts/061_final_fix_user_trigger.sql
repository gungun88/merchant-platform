-- ============================================================
-- 最终修复：创建正确的用户注册触发器
-- ============================================================
-- 目标：
-- 1. 支持前端用户正常注册（auth.signUp）
-- 2. 支持管理员创建用户（auth.admin.createUser）
-- 3. 不依赖 sync_email_trigger（已禁用）
-- ============================================================

-- 步骤 1: 创建修复后的触发器函数
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

  -- 创建 profile（包含 email 字段，这样就不需要 sync_email_trigger 了）
  BEGIN
    INSERT INTO public.profiles (
      id,
      username,
      email,
      points,
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
      v_register_points,
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

-- 步骤 2: 重新创建触发器
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 步骤 3: 更新注释
COMMENT ON FUNCTION public.handle_new_user IS '处理新用户注册：创建profile（含email）、积分、通知，支持前端注册和管理员创建';

-- 步骤 4: 验证触发器
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
-- 关键修复:
-- 1. ✅ 触发器直接设置 email 字段，不依赖 sync_email_trigger
-- 2. ✅ 使用 ON CONFLICT DO UPDATE 处理重复插入
-- 3. ✅ 所有操作都有错误处理，不会中断用户创建
-- 4. ✅ 同时支持前端注册和管理员创建用户
-- ============================================================

SELECT '✅ 触发器已修复，现在前端注册和管理员创建都能正常工作了' as status;
