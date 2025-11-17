-- 添加积分不足预警阈值配置
ALTER TABLE system_settings
ADD COLUMN IF NOT EXISTS low_points_threshold INTEGER DEFAULT 100 CHECK (low_points_threshold >= 0 AND low_points_threshold <= 1000);

COMMENT ON COLUMN system_settings.low_points_threshold IS '积分不足预警阈值（当用户积分低于此值时发送通知）';

-- 更新现有记录
UPDATE system_settings
SET low_points_threshold = 100
WHERE low_points_threshold IS NULL;
