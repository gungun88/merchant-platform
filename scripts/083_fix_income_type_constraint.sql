-- 修复 platform_income 表的 income_type 约束，使其支持支出类型

-- 删除旧的 income_type 约束
ALTER TABLE platform_income
DROP CONSTRAINT IF EXISTS platform_income_income_type_check;

-- 添加新的 income_type 约束，包含收入和支出类型
ALTER TABLE platform_income
ADD CONSTRAINT platform_income_income_type_check
CHECK (income_type IN (
  'deposit_fee',           -- 押金手续费（收入）
  'partner_subscription',  -- 合作伙伴订阅（收入）
  'manual_expense',        -- 手动支出（支出）
  'operational_cost',      -- 运营成本（支出）
  'marketing_cost'         -- 推广费用（支出）
));

-- 更新字段注释
COMMENT ON COLUMN platform_income.income_type IS '
收入类型: deposit_fee（押金手续费）, partner_subscription（合作伙伴订阅）
支出类型: manual_expense（手动支出）, operational_cost（运营成本）, marketing_cost（推广费用）
';

-- 验证修改
SELECT
  conname AS constraint_name,
  pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'platform_income'::regclass
  AND conname LIKE '%income_type%';
