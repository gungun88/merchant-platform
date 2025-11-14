-- 完整添加订阅相关字段到 partners 表
-- 执行日期: 2025-01-15

-- 1. 添加 subscription_unit 字段 (订阅单位: month 或 year)
ALTER TABLE partners
ADD COLUMN IF NOT EXISTS subscription_unit VARCHAR(10) DEFAULT 'year';

-- 2. 添加或重命名 duration_value 字段
DO $$
BEGIN
  -- 如果 duration_years 存在,重命名为 duration_value
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'partners' AND column_name = 'duration_years'
  ) THEN
    ALTER TABLE partners RENAME COLUMN duration_years TO duration_value;
  -- 如果 duration_value 不存在,创建它
  ELSIF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'partners' AND column_name = 'duration_value'
  ) THEN
    ALTER TABLE partners ADD COLUMN duration_value INTEGER DEFAULT 1;
  END IF;
END $$;

-- 3. 添加 unit_fee 字段 (单价)
ALTER TABLE partners
ADD COLUMN IF NOT EXISTS unit_fee DECIMAL(10,2) DEFAULT 100;

-- 4. 添加 total_amount 字段 (总金额)
ALTER TABLE partners
ADD COLUMN IF NOT EXISTS total_amount DECIMAL(10,2) DEFAULT 100;

-- 5. 添加 payment_proof_url 字段 (支付凭证URL)
ALTER TABLE partners
ADD COLUMN IF NOT EXISTS payment_proof_url TEXT;

-- 6. 添加 transaction_hash 字段 (交易哈希/交易ID)
ALTER TABLE partners
ADD COLUMN IF NOT EXISTS transaction_hash TEXT;

-- 添加字段注释
COMMENT ON COLUMN partners.subscription_unit IS '订阅单位: month(按月) 或 year(按年)';
COMMENT ON COLUMN partners.duration_value IS '订阅时长数值(配合subscription_unit使用)';
COMMENT ON COLUMN partners.unit_fee IS '单价(USDT)';
COMMENT ON COLUMN partners.total_amount IS '总金额(USDT)';
COMMENT ON COLUMN partners.payment_proof_url IS '支付凭证图片URL';
COMMENT ON COLUMN partners.transaction_hash IS '交易哈希或交易ID';

-- 刷新 schema cache
NOTIFY pgrst, 'reload schema';
