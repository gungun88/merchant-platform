-- 添加积分兑换外链配置
ALTER TABLE system_settings
ADD COLUMN IF NOT EXISTS coin_exchange_url TEXT DEFAULT NULL;

COMMENT ON COLUMN system_settings.coin_exchange_url IS '积分兑换外链地址（如果为空则跳转帮助中心）';

-- 更新现有记录（默认为空，保持原有跳转帮助中心的行为）
UPDATE system_settings
SET coin_exchange_url = NULL
WHERE coin_exchange_url IS NULL;
