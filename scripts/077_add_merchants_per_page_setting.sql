-- 添加商家列表每页显示数量配置
ALTER TABLE system_settings
ADD COLUMN IF NOT EXISTS merchants_per_page INTEGER DEFAULT 20 CHECK (merchants_per_page > 0 AND merchants_per_page <= 100);

COMMENT ON COLUMN system_settings.merchants_per_page IS '首页商家列表每页显示数量(1-100)';

-- 更新现有记录
UPDATE system_settings
SET merchants_per_page = 20
WHERE merchants_per_page IS NULL;
