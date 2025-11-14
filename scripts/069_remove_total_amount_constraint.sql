-- 删除 partners 表的 total_amount 约束
-- 执行日期: 2025-01-15

-- 删除 check_total_amount 约束(如果存在)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'check_total_amount'
    AND table_name = 'partners'
  ) THEN
    ALTER TABLE partners DROP CONSTRAINT check_total_amount;
    RAISE NOTICE 'Constraint check_total_amount dropped successfully';
  ELSE
    RAISE NOTICE 'Constraint check_total_amount does not exist';
  END IF;
END $$;

-- 刷新 schema cache
NOTIFY pgrst, 'reload schema';
