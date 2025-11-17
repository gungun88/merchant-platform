-- 为 platform_income 表添加交易类型字段，支持收入和支出

-- 添加 transaction_type 字段（默认为 income 保持向后兼容）
ALTER TABLE platform_income
ADD COLUMN IF NOT EXISTS transaction_type VARCHAR(10) DEFAULT 'income'
CHECK (transaction_type IN ('income', 'expense'));

-- 添加 created_by 字段，记录创建记录的管理员（用于手动添加的支出）
ALTER TABLE platform_income
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- 更新表和字段注释
COMMENT ON TABLE platform_income IS '平台财务记录表，记录收入和支出';

COMMENT ON COLUMN platform_income.transaction_type IS '交易类型：income（收入）或 expense（支出）';

COMMENT ON COLUMN platform_income.income_type IS '
收入类型: deposit_fee（押金手续费）, partner_subscription（合作伙伴订阅）
支出类型: manual_expense（手动支出）, operational_cost（运营成本）, marketing_cost（推广费用）
';

COMMENT ON COLUMN platform_income.created_by IS '创建记录的管理员ID（仅用于手动添加的记录）';

-- 创建索引以提升查询性能
CREATE INDEX IF NOT EXISTS idx_platform_income_transaction_type
ON platform_income(transaction_type);

CREATE INDEX IF NOT EXISTS idx_platform_income_created_by
ON platform_income(created_by) WHERE created_by IS NOT NULL;
