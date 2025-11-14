-- 添加 view_contact_merchant_deduct 字段（如果不存在）
-- 说明：被查看商家需要扣除的积分

DO $$
BEGIN
  -- 检查字段是否存在
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'system_settings'
    AND column_name = 'view_contact_merchant_deduct'
  ) THEN
    -- 添加字段
    ALTER TABLE system_settings
    ADD COLUMN view_contact_merchant_deduct INTEGER DEFAULT 10;

    -- 添加注释
    COMMENT ON COLUMN system_settings.view_contact_merchant_deduct IS '被查看商家扣除的积分';

    RAISE NOTICE '✅ 成功添加字段: view_contact_merchant_deduct';
  ELSE
    RAISE NOTICE '✓ 字段已存在: view_contact_merchant_deduct';
  END IF;
END $$;

-- 确保现有记录有这个字段的值
UPDATE system_settings
SET view_contact_merchant_deduct = COALESCE(view_contact_merchant_deduct, 10)
WHERE id = '00000000-0000-0000-0000-000000000001';

-- 重新加载 PostgREST 架构缓存
NOTIFY pgrst, 'reload schema';

-- 验证字段已添加
SELECT
  column_name,
  data_type,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'system_settings'
  AND column_name = 'view_contact_merchant_deduct';

-- 查看当前值
SELECT view_contact_merchant_deduct
FROM system_settings
WHERE id = '00000000-0000-0000-0000-000000000001';
