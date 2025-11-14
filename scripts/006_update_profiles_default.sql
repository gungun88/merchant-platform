-- 修改profiles表，确保新注册用户默认不是商家
ALTER TABLE profiles 
ALTER COLUMN is_merchant SET DEFAULT false;

-- 更新触发器，确保新用户注册时is_merchant为false
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, points, is_merchant)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    100,
    false  -- 默认不是商家
  );
  
  -- 添加注册积分记录
  INSERT INTO public.points_log (user_id, points_change, action_type, description)
  VALUES (NEW.id, 100, 'register', '注册奖励');
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
