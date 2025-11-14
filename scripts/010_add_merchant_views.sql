-- 创建增加商家浏览量的数据库函数
CREATE OR REPLACE FUNCTION increment_merchant_views(merchant_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE merchants
  SET views = COALESCE(views, 0) + 1
  WHERE id = merchant_id;
END;
$$;

-- 确保views字段存在（如果不存在则添加）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'merchants' AND column_name = 'views'
  ) THEN
    ALTER TABLE merchants ADD COLUMN views INTEGER DEFAULT 0;
  END IF;
END $$;
