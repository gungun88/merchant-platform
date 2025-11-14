-- 添加登录安全相关字段到 profiles 表
-- 用于实现登录失败次数限制和账号锁定功能

-- 添加登录失败次数字段
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS login_failed_attempts INTEGER DEFAULT 0;

-- 添加账号锁定时间字段
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS account_locked_until TIMESTAMPTZ;

-- 添加最后登录失败时间字段（用于追踪）
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS last_failed_login_at TIMESTAMPTZ;

-- 添加注释
COMMENT ON COLUMN profiles.login_failed_attempts IS '登录失败次数';
COMMENT ON COLUMN profiles.account_locked_until IS '账号锁定截止时间';
COMMENT ON COLUMN profiles.last_failed_login_at IS '最后一次登录失败时间';
