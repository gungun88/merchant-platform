-- 修改邀请系统设计
-- 将邀请码存储在用户的 profile 中，而不是创建空的邀请记录

-- 1. 在 profiles 表中添加邀请码字段
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS invitation_code TEXT UNIQUE;

-- 2. 为邀请码字段添加索引
CREATE INDEX IF NOT EXISTS idx_profiles_invitation_code ON profiles(invitation_code);

-- 3. 添加注释
COMMENT ON COLUMN profiles.invitation_code IS '用户的专属邀请码';

-- 4. 修改 invitations 表的逻辑
-- invitations 表现在只用于记录真实的邀请关系（当被邀请人注册时才创建记录）
-- 删除之前自动生成的空记录
DELETE FROM invitations WHERE invitee_id IS NULL;

-- 5. 验证结果
DO $$
BEGIN
  RAISE NOTICE '✓ profiles 表已添加 invitation_code 字段';
  RAISE NOTICE '✓ 索引已添加';
  RAISE NOTICE '✓ 已清理空的邀请记录';
END $$;
