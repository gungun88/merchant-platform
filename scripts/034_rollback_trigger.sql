-- 回滚到原始的触发器（不在触发器中记录积分）
-- 因为积分记录应该由应用层处理，避免重复

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

  -- 插入用户 profile，包含邀请码和初始100积分
  INSERT INTO public.profiles (id, username, points, is_merchant, invitation_code)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1)),
    100,  -- 注册赠送100积分
    false,
    v_invitation_code
  )
  ON CONFLICT (id) DO NOTHING;

  -- 不在这里记录积分，让应用层处理
  -- 因为应用层会调用 processInvitationReward，那里会处理所有积分和通知

  RETURN new;
END;
$$;

COMMENT ON FUNCTION public.handle_new_user IS '处理新用户注册：创建profile和邀请码，积分记录由应用层处理';
