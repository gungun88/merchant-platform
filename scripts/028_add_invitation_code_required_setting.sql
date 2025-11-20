-- 添加邀请码必填配置字段
-- 作者: Claude
-- 创建时间: 2025-11-20
-- 描述: 在系统设置表中添加邀请码是否必填的配置字段

-- 添加邀请码必填配置字段
ALTER TABLE system_settings
ADD COLUMN IF NOT EXISTS invitation_code_required BOOLEAN DEFAULT FALSE;

-- 添加注释
COMMENT ON COLUMN system_settings.invitation_code_required IS '注册时邀请码是否必填（true=必填，false=选填）';

-- 更新现有记录，默认为选填
UPDATE system_settings
SET invitation_code_required = FALSE
WHERE id = '00000000-0000-0000-0000-000000000001';
