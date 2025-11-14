-- 修复触发器和 points_log 表的 RLS 问题

-- 1. 删除所有旧的 RLS 策略
DROP POLICY IF EXISTS "points_log_select_own" ON public.points_log;
DROP POLICY IF EXISTS "points_log_insert_authenticated" ON public.points_log;

-- 2. 创建新的 RLS 策略
-- 用户可以查看自己的积分记录
CREATE POLICY "points_log_select_own"
  ON public.points_log FOR SELECT
  USING (auth.uid() = user_id);

-- 允许触发器函数插入积分记录（SECURITY DEFINER 函数可以绕过 RLS）
-- 使用 WITH CHECK (true) 允许系统插入任何记录
CREATE POLICY "points_log_insert_system"
  ON public.points_log FOR INSERT
  WITH CHECK (true);

-- 3. 更新触发器函数，添加 invitation_code 生成和 points_log 记录
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  -- 插入用户 profile，包含邀请码
  INSERT INTO public.profiles (id, username, points, is_merchant, invitation_code)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1)),
    100,
    false,
    generate_invitation_code()
  )
  ON CONFLICT (id) DO NOTHING;

  -- 记录注册积分
  INSERT INTO public.points_log (user_id, points_change, action_type, description)
  VALUES (new.id, 100, 'register', '注册赠送积分');

  RETURN new;
END;
$function$;
