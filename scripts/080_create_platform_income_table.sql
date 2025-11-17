-- 创建平台收入记录表
CREATE TABLE IF NOT EXISTS platform_income (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 收入类型（只有两种）
  income_type VARCHAR(50) NOT NULL CHECK (income_type IN ('deposit_fee', 'partner_subscription')),

  -- 金额（USDT）
  amount DECIMAL(10, 2) NOT NULL CHECK (amount >= 0),

  -- 关联信息
  merchant_id UUID REFERENCES merchants(id) ON DELETE SET NULL, -- 如果是押金手续费，关联商家
  partner_id UUID REFERENCES partners(id) ON DELETE SET NULL, -- 如果是合作伙伴，关联合作伙伴
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- 付款的用户

  -- 详细说明
  description TEXT NOT NULL,

  -- 额外信息（JSON格式，存储详细数据）
  details JSONB,

  -- 时间
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  income_date DATE DEFAULT CURRENT_DATE, -- 收入日期（便于统计）

  -- 备注（管理员可以添加）
  admin_note TEXT
);

-- 创建索引以提升查询性能
CREATE INDEX idx_platform_income_type ON platform_income(income_type);
CREATE INDEX idx_platform_income_date ON platform_income(income_date DESC);
CREATE INDEX idx_platform_income_merchant ON platform_income(merchant_id) WHERE merchant_id IS NOT NULL;
CREATE INDEX idx_platform_income_partner ON platform_income(partner_id) WHERE partner_id IS NOT NULL;
CREATE INDEX idx_platform_income_created_at ON platform_income(created_at DESC);

-- 添加表注释
COMMENT ON TABLE platform_income IS '平台收入记录表，记录押金手续费和合作伙伴订阅费';
COMMENT ON COLUMN platform_income.income_type IS '收入类型：deposit_fee（押金手续费）或 partner_subscription（合作伙伴订阅）';
COMMENT ON COLUMN platform_income.amount IS '收入金额（USDT）';
COMMENT ON COLUMN platform_income.details IS 'JSON格式的详细信息，包含原始押金、手续费率、订阅时长等';
COMMENT ON COLUMN platform_income.income_date IS '收入日期，用于按日期统计';
