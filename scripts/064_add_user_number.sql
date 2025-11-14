-- 添加用户编号字段(从1001开始)
-- Add user_number field to profiles table starting from 1001

-- 1. 创建序列,从1001开始
CREATE SEQUENCE IF NOT EXISTS user_number_seq START WITH 1001;

-- 2. 添加 user_number 字段(暂时允许NULL,用于更新现有用户)
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS user_number INTEGER UNIQUE;

-- 3. 为现有用户分配编号
DO $$
DECLARE
  profile_record RECORD;
  current_num INTEGER := 1001;
BEGIN
  -- 按创建时间顺序为现有用户分配编号
  FOR profile_record IN
    SELECT id FROM profiles
    WHERE user_number IS NULL
    ORDER BY created_at ASC
  LOOP
    UPDATE profiles
    SET user_number = current_num
    WHERE id = profile_record.id;

    current_num := current_num + 1;
  END LOOP;

  -- 更新序列的当前值为下一个可用编号
  PERFORM setval('user_number_seq', current_num);
END $$;

-- 4. 设置字段为NOT NULL(现在所有用户都有编号了)
ALTER TABLE profiles
ALTER COLUMN user_number SET NOT NULL;

-- 5. 更新用户创建触发器,自动分配编号
-- 先删除旧触发器(如果存在)
DROP TRIGGER IF EXISTS assign_user_number_on_insert ON profiles;

-- 创建触发器函数
CREATE OR REPLACE FUNCTION assign_user_number()
RETURNS TRIGGER AS $$
BEGIN
  -- 如果user_number为空,自动分配下一个编号
  IF NEW.user_number IS NULL THEN
    NEW.user_number := nextval('user_number_seq');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 创建触发器
CREATE TRIGGER assign_user_number_on_insert
BEFORE INSERT ON profiles
FOR EACH ROW
EXECUTE FUNCTION assign_user_number();

-- 6. 添加索引以优化搜索
CREATE INDEX IF NOT EXISTS idx_profiles_user_number ON profiles(user_number);

-- 完成提示
DO $$
BEGIN
  RAISE NOTICE '✅ 用户编号系统已成功创建!';
  RAISE NOTICE '✅ 现有用户已分配编号(从1001开始)';
  RAISE NOTICE '✅ 新用户将自动获得递增编号';
  RAISE NOTICE '✅ 索引已创建,支持快速搜索';
END $$;
