-- ====================================================================
-- 为合作伙伴表添加备注字段
-- 用途: 管理员可以为合作伙伴添加内部备注
-- ====================================================================

-- 添加备注字段
ALTER TABLE partners ADD COLUMN IF NOT EXISTS admin_notes TEXT;

-- 添加字段注释
COMMENT ON COLUMN partners.admin_notes IS '管理员备注（仅管理员可见）';

-- 验证字段是否添加成功
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'partners' AND column_name = 'admin_notes';
