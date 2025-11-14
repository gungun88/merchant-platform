-- ============================================================
-- 刷新 PostgREST 架构缓存并添加 site_favicon_url 字段
-- ============================================================

-- 步骤 1: 添加 site_favicon_url 字段(如果不存在)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'system_settings'
    AND column_name = 'site_favicon_url'
  ) THEN
    ALTER TABLE system_settings
    ADD COLUMN site_favicon_url TEXT;
    COMMENT ON COLUMN system_settings.site_favicon_url IS '网站 Favicon 图标 URL (显示在浏览器标签页、书签等位置)';
    RAISE NOTICE '✅ 添加字段: site_favicon_url';
  ELSE
    RAISE NOTICE '✓ 字段已存在: site_favicon_url';
  END IF;
END $$;

-- 步骤 2: 通知 PostgREST 重新加载架构
NOTIFY pgrst, 'reload schema';

-- 步骤 3: 验证字段是否已添加
SELECT
  column_name,
  data_type,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'system_settings'
  AND column_name = 'site_favicon_url';

-- 步骤 4: 查看当前系统设置(验证所有字段)
SELECT
  platform_name,
  platform_logo_url,
  platform_description,
  site_favicon_url
FROM system_settings
WHERE id = '00000000-0000-0000-0000-000000000001';

-- ============================================================
-- 执行完成！
-- ============================================================
-- 说明:
-- 1. 如果看到 "✅ 添加字段: site_favicon_url" 表示字段添加成功
-- 2. 如果看到 "✓ 字段已存在: site_favicon_url" 表示字段已经存在
-- 3. PostgREST 缓存已刷新,等待几秒后刷新页面即可
-- ============================================================
