-- 修复注册送积分功能，使用新的 point_transactions 表和通知系统

-- 更新触发器函数，使用新的积分系统
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invitation_code TEXT;
BEGIN
  -- 生成邀请码
  v_invitation_code := generate_invitation_code();

  -- 插入用户 profile，包含邀请码
  INSERT INTO public.profiles (id, username, points, is_merchant, invitation_code)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1)),
    100,  -- 注册赠送100积分
    false,
    v_invitation_code
  )
  ON CONFLICT (id) DO NOTHING;

  -- 使用新的 record_point_transaction 函数记录注册积分
  PERFORM record_point_transaction(
    new.id,
    100,
    'registration',
    '注册赠送积分 +100积分',
    NULL,
    NULL,
    jsonb_build_object('source', 'registration')
  );

  -- 发送注册欢迎通知
  PERFORM create_notification(
    new.id,
    'system',
    'registration',
    '欢迎加入',
    '注册成功！您已获得 100 积分奖励，快去体验吧！',
    NULL,
    NULL,
    jsonb_build_object('points', 100),
    'normal',
    NULL
  );

  RETURN new;
END;
$$;

-- 确保触发器存在
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

COMMENT ON FUNCTION public.handle_new_user IS '处理新用户注册：创建profile、发放注册积分、发送欢迎通知';
