-- 修复邀请码生成问题
-- 确保用户注册时自动生成邀请码

-- 1. 更新现有用户的邀请码(如果为空)
UPDATE profiles
SET invitation_code = generate_invitation_code()
WHERE invitation_code IS NULL;

-- 2. 修改 handle_new_user 触发器函数,在创建 profile 时自动生成邀请码
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
begin
  insert into public.profiles (id, username, points, is_merchant, invitation_code)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1)),
    100,  -- 注册赠送100积分
    false,
    generate_invitation_code()  -- 自动生成邀请码
  )
  on conflict (id) do nothing;

  -- 记录注册赠送的积分
  insert into public.points_logs (user_id, points, type, description)
  values (new.id, 100, 'registration', '注册赠送积分');

  return new;
end;
$function$;
