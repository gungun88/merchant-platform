-- 添加 email 字段到 profiles 表并同步 auth.users 的 email
-- 这样可以通过 email 查询并实现登录安全功能

-- 1. 添加 email 字段
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS email TEXT;

-- 2. 创建唯一索引
CREATE UNIQUE INDEX IF NOT EXISTS profiles_email_idx ON profiles(email);

-- 3. 从 auth.users 同步现有数据
UPDATE profiles
SET email = auth.users.email
FROM auth.users
WHERE profiles.id = auth.users.id
AND profiles.email IS NULL;

-- 4. 创建触发器函数：当 auth.users 的 email 更新时同步到 profiles
CREATE OR REPLACE FUNCTION sync_email_to_profile()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE profiles
  SET email = NEW.email
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. 创建触发器
DROP TRIGGER IF EXISTS sync_email_trigger ON auth.users;
CREATE TRIGGER sync_email_trigger
AFTER INSERT OR UPDATE OF email ON auth.users
FOR EACH ROW
EXECUTE FUNCTION sync_email_to_profile();

-- 6. 添加注释
COMMENT ON COLUMN profiles.email IS '用户邮箱（从 auth.users 同步）';
