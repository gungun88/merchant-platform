-- 添加签到相关字段到 profiles 表
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS last_checkin TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS consecutive_checkin_days INTEGER DEFAULT 0;

-- 为现有用户设置默认值
UPDATE profiles
SET consecutive_checkin_days = 0
WHERE consecutive_checkin_days IS NULL;

-- 添加注释说明
COMMENT ON COLUMN profiles.last_checkin IS '最后签到时间';
COMMENT ON COLUMN profiles.consecutive_checkin_days IS '连续签到天数';
