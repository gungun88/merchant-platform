-- 最终修复方案：让触发器只创建profile，所有积分和通知由应用层统一处理

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

  -- 仅插入用户 profile，不处理积分和通知
  -- 让前端调用 server action 来统一处理
  INSERT INTO public.profiles (id, username, points, is_merchant, invitation_code)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1)),
    0,  -- 初始0积分，由应用层添加
    false,
    v_invitation_code
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN new;
END;
$$;

COMMENT ON FUNCTION public.handle_new_user IS '处理新用户注册：仅创建profile，积分和通知由应用层处理';
