-- 修复邀请系统：移除 invitation_code 的唯一约束
-- 因为同一个邀请码可以被多个用户使用

-- 1. 删除唯一约束
ALTER TABLE public.invitations
DROP CONSTRAINT IF EXISTS invitations_invitation_code_key;

-- 2. 如果有唯一索引也删除
DROP INDEX IF EXISTS invitations_invitation_code_key;

-- 3. 创建普通索引以优化查询性能
CREATE INDEX IF NOT EXISTS idx_invitations_invitation_code
ON public.invitations(invitation_code);

COMMENT ON TABLE public.invitations IS '邀请记录表 - 同一个邀请码可以邀请多个用户';
