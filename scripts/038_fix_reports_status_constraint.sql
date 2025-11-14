-- 修复 reports 表的 status 检查约束
-- 问题：status 值 "approved" 不在约束允许的值中

-- 1. 查看当前的约束
SELECT
  conname as constraint_name,
  pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'public.reports'::regclass
  AND contype = 'c'  -- check constraint
  AND conname LIKE '%status%';

-- 2. 删除旧的 status 检查约束
ALTER TABLE public.reports DROP CONSTRAINT IF EXISTS reports_status_check;
ALTER TABLE public.reports DROP CONSTRAINT IF EXISTS check_status;

-- 3. 创建新的 status 检查约束，包含所有可能的状态值
ALTER TABLE public.reports
ADD CONSTRAINT reports_status_check
CHECK (status IN ('pending', 'approved', 'rejected'));

-- 4. 验证现有数据
SELECT status, COUNT(*) as count
FROM public.reports
GROUP BY status
ORDER BY status;

-- 5. 显示新的约束定义
SELECT
  conname as constraint_name,
  pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'public.reports'::regclass
  AND contype = 'c'
  AND conname = 'reports_status_check';

SELECT '✅ Status 约束已修复' as status;
