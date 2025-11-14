-- 添加合作伙伴订阅相关字段
-- 用途: 添加有效期、年费、支付凭证等字段以支持合作伙伴付费订阅功能

-- 添加新字段
ALTER TABLE partners ADD COLUMN IF NOT EXISTS duration_years INTEGER DEFAULT 1;
ALTER TABLE partners ADD COLUMN IF NOT EXISTS annual_fee DECIMAL(10, 2) DEFAULT 100.00;
ALTER TABLE partners ADD COLUMN IF NOT EXISTS total_amount DECIMAL(10, 2);
ALTER TABLE partners ADD COLUMN IF NOT EXISTS payment_proof_url TEXT;
ALTER TABLE partners ADD COLUMN IF NOT EXISTS transaction_hash TEXT;
ALTER TABLE partners ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE;

-- 添加字段注释
COMMENT ON COLUMN partners.duration_years IS '订阅时长（年），最低1年';
COMMENT ON COLUMN partners.annual_fee IS '年费（USDT），默认100';
COMMENT ON COLUMN partners.total_amount IS '总金额（USDT），等于 annual_fee * duration_years';
COMMENT ON COLUMN partners.payment_proof_url IS '支付凭证图片URL';
COMMENT ON COLUMN partners.transaction_hash IS '区块链交易哈希或支付平台交易ID';
COMMENT ON COLUMN partners.expires_at IS '到期时间，审核通过后开始计算';

-- 更新现有数据的默认值（如果有数据的话）
UPDATE partners
SET
  duration_years = 1,
  annual_fee = 100.00,
  total_amount = 100.00
WHERE duration_years IS NULL;

-- 删除旧约束（如果存在）
ALTER TABLE partners DROP CONSTRAINT IF EXISTS check_duration_years;
ALTER TABLE partners DROP CONSTRAINT IF EXISTS check_annual_fee;
ALTER TABLE partners DROP CONSTRAINT IF EXISTS check_total_amount;

-- 添加约束检查
ALTER TABLE partners ADD CONSTRAINT check_duration_years CHECK (duration_years >= 1);
ALTER TABLE partners ADD CONSTRAINT check_annual_fee CHECK (annual_fee >= 100.00);
ALTER TABLE partners ADD CONSTRAINT check_total_amount CHECK (total_amount >= 100.00);
