-- 最简版本：只添加 is_active 字段
-- 如果您已经有 reports 表，只需要这个字段即可

-- 添加商家上架状态字段
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'merchants' AND column_name = 'is_active'
  ) THEN
    ALTER TABLE merchants ADD COLUMN is_active BOOLEAN DEFAULT true;
    RAISE NOTICE '✓ 已添加 merchants.is_active 字段';
  ELSE
    RAISE NOTICE '✓ merchants.is_active 字段已存在';
  END IF;
END $$;

-- 为所有现有商家设置为上架状态
UPDATE merchants SET is_active = true WHERE is_active IS NULL;

-- 验证
SELECT
  column_name,
  data_type,
  column_default
FROM information_schema.columns
WHERE table_name = 'merchants' AND column_name = 'is_active';
