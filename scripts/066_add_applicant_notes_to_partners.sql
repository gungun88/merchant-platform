-- 添加申请人备注字段到 partners 表
-- 执行日期: 2025-01-15

-- 添加 applicant_notes 字段 (申请人填写的备注)
ALTER TABLE partners
ADD COLUMN IF NOT EXISTS applicant_notes TEXT;

-- 添加字段注释
COMMENT ON COLUMN partners.applicant_notes IS '申请人备注（申请时填写的备注信息）';

-- 刷新 schema cache
NOTIFY pgrst, 'reload schema';
