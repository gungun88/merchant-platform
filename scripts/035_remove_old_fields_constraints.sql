-- 移除 reports 表旧字段的 NOT NULL 约束
-- 使旧字段变为可选，只使用新字段

-- 1. 移除旧字段的 NOT NULL 约束
ALTER TABLE public.reports ALTER COLUMN reason DROP NOT NULL;
ALTER TABLE public.reports ALTER COLUMN details DROP NOT NULL;

-- 2. 验证约束已移除
SELECT
  column_name,
  is_nullable,
  data_type
FROM information_schema.columns
WHERE table_name = 'reports'
  AND table_schema = 'public'
  AND column_name IN ('reason', 'details', 'report_type', 'report_reason')
ORDER BY column_name;

-- 3. 显示说明
SELECT '旧字段 reason 和 details 的 NOT NULL 约束已移除' as status;
SELECT '现在可以只使用新字段 report_type 和 report_reason' as info;
