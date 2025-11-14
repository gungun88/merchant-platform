-- 创建邀请表
-- 用于记录用户邀请关系和奖励状态

-- 1. 创建邀请表
CREATE TABLE IF NOT EXISTS invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inviter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invitee_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  invitation_code TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'expired')),
  inviter_rewarded BOOLEAN DEFAULT false,
  invitee_rewarded BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- 2. 添加表注释
COMMENT ON TABLE invitations IS '用户邀请记录表';
COMMENT ON COLUMN invitations.inviter_id IS '邀请人ID';
COMMENT ON COLUMN invitations.invitee_id IS '被邀请人ID';
COMMENT ON COLUMN invitations.invitation_code IS '邀请码(唯一)';
COMMENT ON COLUMN invitations.status IS '状态: pending=待完成, completed=已完成, expired=已过期';
COMMENT ON COLUMN invitations.inviter_rewarded IS '邀请人是否已获得奖励';
COMMENT ON COLUMN invitations.invitee_rewarded IS '被邀请人是否已获得奖励';
COMMENT ON COLUMN invitations.completed_at IS '完成时间';

-- 3. 创建索引
CREATE INDEX IF NOT EXISTS idx_invitations_inviter_id ON invitations(inviter_id);
CREATE INDEX IF NOT EXISTS idx_invitations_invitee_id ON invitations(invitee_id);
CREATE INDEX IF NOT EXISTS idx_invitations_invitation_code ON invitations(invitation_code);
CREATE INDEX IF NOT EXISTS idx_invitations_status ON invitations(status);
CREATE INDEX IF NOT EXISTS idx_invitations_created_at ON invitations(created_at DESC);

-- 4. 启用 RLS
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;

-- 5. 创建 RLS 策略

-- 用户可以查看自己作为邀请人的记录
CREATE POLICY "Users can view their own invitations as inviter"
  ON invitations FOR SELECT
  TO authenticated
  USING (auth.uid() = inviter_id);

-- 用户可以查看自己作为被邀请人的记录
CREATE POLICY "Users can view their own invitations as invitee"
  ON invitations FOR SELECT
  TO authenticated
  USING (auth.uid() = invitee_id);

-- 用户可以创建邀请记录
CREATE POLICY "Users can create invitations"
  ON invitations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = inviter_id);

-- 允许更新邀请状态(通过服务端逻辑)
CREATE POLICY "Users can update their invitations"
  ON invitations FOR UPDATE
  TO authenticated
  USING (auth.uid() = inviter_id OR auth.uid() = invitee_id);

-- 6. 创建生成邀请码的函数
CREATE OR REPLACE FUNCTION generate_invitation_code()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  code TEXT;
  exists BOOLEAN;
BEGIN
  LOOP
    -- 生成8位随机字符串
    code := upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 8));

    -- 检查是否已存在
    SELECT EXISTS(SELECT 1 FROM invitations WHERE invitation_code = code) INTO exists;

    EXIT WHEN NOT exists;
  END LOOP;

  RETURN code;
END;
$$;

-- 7. 验证结果
DO $$
BEGIN
  RAISE NOTICE '✓ invitations 表已创建';
  RAISE NOTICE '✓ 索引已添加';
  RAISE NOTICE '✓ RLS策略已配置';
  RAISE NOTICE '✓ 邀请码生成函数已创建';
END $$;
