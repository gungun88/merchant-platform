-- ============================================================
-- 修复注册触发器 - 包含用户编号字段
-- ============================================================
-- 问题描述:
-- 之前的修复触发器没有包含 user_number 字段
-- 导致新注册用户没有用户编号
-- ============================================================

-- 步骤 1: 修复触发器函数，包含所有必要字段
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

  -- 生成用户编号
  BEGIN
    v_user_number := nextval('user_number_seq');
  EXCEPTION WHEN OTHERS THEN
    -- 如果序列不存在，使用一个默认值
    v_user_number := NULL;
  END;

  -- 创建 profile（初始积分设为 0，稍后通过交易记录增加）
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
      0,  -- 初始设为 0，稍后通过 record_point_transaction 增加
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
COMMENT ON FUNCTION public.handle_new_user IS '处理新用户注册：创建profile（包含用户编号）、通过交易记录增加注册积分、发送通知';

-- 步骤 3: 为刚才注册的用户补充缺失的数据
DO $$
DECLARE
  v_user RECORD;
  v_user_number INTEGER;
BEGIN
  -- 查找没有用户编号的用户
  FOR v_user IN
    SELECT id, username
    FROM profiles
    WHERE user_number IS NULL
  LOOP
    -- 分配用户编号
    v_user_number := nextval('user_number_seq');

    UPDATE profiles
    SET user_number = v_user_number
    WHERE id = v_user.id;

    RAISE NOTICE 'Assigned user_number % to user %', v_user_number, v_user.username;
  END LOOP;

  -- 查找积分为0但没有交易记录的用户（说明注册时交易记录创建失败）
  FOR v_user IN
    SELECT p.id, p.username
    FROM profiles p
    WHERE p.points = 0
      AND NOT EXISTS (
        SELECT 1 FROM point_transactions pt
        WHERE pt.user_id = p.id
      )
  LOOP
    -- 手动创建注册积分交易记录
    PERFORM record_point_transaction(
      v_user.id,
      100,
      'registration',
      '注册赠送积分 +100积分',
      NULL,
      NULL,
      jsonb_build_object('source', 'registration_fix')
    );

    RAISE NOTICE 'Created registration points for user %', v_user.username;
  END LOOP;
END $$;

-- ============================================================
-- 执行完成！
-- ============================================================
-- 修复内容:
-- 1. ✅ 触发器现在包含 user_number 字段
-- 2. ✅ 为已注册但缺失数据的用户补充用户编号和积分
-- 3. ✅ 新注册用户将正确获得编号和积分
-- ============================================================

SELECT '✅ 注册触发器已修复，包含用户编号！' as status;
