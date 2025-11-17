-- 修复 platform_income 表的 transaction_type 字段约束

-- 先删除可能存在的旧约束
DO $$
BEGIN
    -- 尝试删除可能存在的约束（如果不存在会被忽略）
    EXECUTE 'ALTER TABLE platform_income DROP CONSTRAINT IF EXISTS platform_income_transaction_type_check';
EXCEPTION
    WHEN undefined_object THEN
        NULL;
END $$;

-- 如果字段不存在，先添加字段
ALTER TABLE platform_income
ADD COLUMN IF NOT EXISTS transaction_type VARCHAR(10) DEFAULT 'income';

-- 添加 created_by 字段（如果不存在）
ALTER TABLE platform_income
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- 添加 income_date 字段（如果不存在，用于记录收入日期）
ALTER TABLE platform_income
ADD COLUMN IF NOT EXISTS income_date DATE DEFAULT CURRENT_DATE;

-- 单独添加 CHECK 约束
ALTER TABLE platform_income
ADD CONSTRAINT platform_income_transaction_type_check
CHECK (transaction_type IN ('income', 'expense'));

-- 更新表和字段注释
COMMENT ON TABLE platform_income IS '平台财务记录表，记录收入和支出';

COMMENT ON COLUMN platform_income.transaction_type IS '交易类型：income（收入）或 expense（支出）';

COMMENT ON COLUMN platform_income.income_type IS '
收入类型: deposit_fee（押金手续费）, partner_subscription（合作伙伴订阅）
支出类型: manual_expense（手动支出）, operational_cost（运营成本）, marketing_cost（推广费用）
';

COMMENT ON COLUMN platform_income.created_by IS '创建记录的管理员ID（仅用于手动添加的记录）';

COMMENT ON COLUMN platform_income.income_date IS '收入/支出日期（用于按日期统计）';

-- 创建索引以提升查询性能
CREATE INDEX IF NOT EXISTS idx_platform_income_transaction_type
ON platform_income(transaction_type);

CREATE INDEX IF NOT EXISTS idx_platform_income_created_by
ON platform_income(created_by) WHERE created_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_platform_income_income_date
ON platform_income(income_date);

-- 为已有记录设置 income_date（如果为空）
UPDATE platform_income
SET income_date = created_at::date
WHERE income_date IS NULL;
