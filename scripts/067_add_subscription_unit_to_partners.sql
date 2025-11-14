-- 添加订阅单位字段到 partners 表
-- 执行日期: 2025-01-15

-- 添加 subscription_unit 字段 (订阅单位: month 或 year)
ALTER TABLE partners
ADD COLUMN IF NOT EXISTS subscription_unit VARCHAR(10) DEFAULT 'year';

-- 重命名 duration_years 为 duration_value (保留数值,但现在可以表示月或年)
-- 注意: 如果字段已经存在,可以跳过这一步
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'partners' AND column_name = 'duration_years'
  ) THEN
    ALTER TABLE partners RENAME COLUMN duration_years TO duration_value;
  END IF;
END $$;

-- 添加字段注释
COMMENT ON COLUMN partners.subscription_unit IS '订阅单位: month(按月) 或 year(按年)';
COMMENT ON COLUMN partners.duration_value IS '订阅时长数值(配合subscription_unit使用)';

-- 刷新 schema cache
NOTIFY pgrst, 'reload schema';
