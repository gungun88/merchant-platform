-- ============================================================
-- 添加敏感词过滤配置
-- ============================================================
-- 在 system_settings 表添加 sensitive_words 字段
-- 用于存储敏感词列表，用于过滤商家入驻申请的详情描述
-- ============================================================

-- 步骤 1: 添加 sensitive_words 字段（JSON 数组格式）
ALTER TABLE system_settings
ADD COLUMN IF NOT EXISTS sensitive_words JSONB DEFAULT '[]'::jsonb;

-- 步骤 2: 添加字段注释
COMMENT ON COLUMN system_settings.sensitive_words IS '敏感词列表（用于过滤商家入驻描述等内容）';

-- 步骤 3: 插入默认的敏感词（可选）
UPDATE system_settings
SET sensitive_words = '["微信", "QQ", "WeChat", "VX", "vx", "wx", "WX", "加我", "联系方式", "手机号", "电话", "网址", "http", "www", ".com", ".cn"]'::jsonb
WHERE id = '00000000-0000-0000-0000-000000000001'
AND sensitive_words = '[]'::jsonb;

-- 步骤 4: 验证字段是否添加成功
SELECT
  column_name,
  data_type,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'system_settings'
  AND column_name = 'sensitive_words';

-- 步骤 5: 查看当前配置
SELECT
  platform_name,
  sensitive_words
FROM system_settings
WHERE id = '00000000-0000-0000-0000-000000000001';

-- ============================================================
-- 执行完成！
-- ============================================================
-- 说明:
-- 1. ✅ 添加了 sensitive_words 字段（JSONB 类型，存储字符串数组）
-- 2. ✅ 设置了默认的常见敏感词
-- 3. ✅ 管理员可以在后台自由添加/删除敏感词
-- ============================================================

SELECT '✅ 敏感词配置字段已添加' as status;
