-- 添加举报者联系方式字段到 reports 表
-- 执行日期: 2025-01-15

-- 添加 reporter_contact 字段
ALTER TABLE reports
ADD COLUMN IF NOT EXISTS reporter_contact TEXT;

-- 添加字段注释
COMMENT ON COLUMN reports.reporter_contact IS '举报者联系方式（微信、电话、Telegram等）';

-- 刷新 schema cache
NOTIFY pgrst, 'reload schema';
