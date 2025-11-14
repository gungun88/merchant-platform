-- 为商家表添加置顶类型字段
-- 执行日期: 2025-01-15

-- 1. 添加 pin_type 字段 (置顶类型: null=未置顶, self=自助置顶, admin=官方置顶)
ALTER TABLE merchants
ADD COLUMN IF NOT EXISTS pin_type VARCHAR(10) DEFAULT NULL;

-- 2. 添加 pin_expires_at 字段 (自助置顶的到期时间)
-- 注意: 官方置顶没有到期时间,pin_expires_at 保持为 NULL
ALTER TABLE merchants
ADD COLUMN IF NOT EXISTS pin_expires_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- 3. 迁移现有数据: 将 is_topped = true 的商家迁移为自助置顶
-- 将现有的 topped_until 值复制到 pin_expires_at
UPDATE merchants
SET
  pin_type = 'self',
  pin_expires_at = topped_until
WHERE is_topped = true;

-- 4. 添加字段注释
COMMENT ON COLUMN merchants.pin_type IS '置顶类型: null(未置顶), self(自助置顶), admin(官方置顶)';
COMMENT ON COLUMN merchants.pin_expires_at IS '自助置顶的到期时间(官方置顶无到期时间)';

-- 5. 创建索引以优化排序查询
CREATE INDEX IF NOT EXISTS idx_merchants_pin_type ON merchants(pin_type);
CREATE INDEX IF NOT EXISTS idx_merchants_pin_expires_at ON merchants(pin_expires_at);

-- 6. 刷新 schema cache
NOTIFY pgrst, 'reload schema';
