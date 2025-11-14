-- 添加站点图标字段到系统设置表
ALTER TABLE system_settings
ADD COLUMN IF NOT EXISTS site_favicon_url TEXT;

-- 添加注释
COMMENT ON COLUMN system_settings.site_favicon_url IS '网站 Favicon 图标 URL (显示在浏览器标签页、书签等位置)';
