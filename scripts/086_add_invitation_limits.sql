-- 添加邀请次数限制系统
-- 实现方案1：限制每个用户的邀请次数

-- 1. 在 profiles 表中添加邀请相关字段
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS max_invitations INTEGER DEFAULT 5;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS used_invitations INTEGER DEFAULT 0;

-- 2. 添加字段注释
COMMENT ON COLUMN profiles.max_invitations IS '用户可以邀请的最大人数（默认5人）';
COMMENT ON COLUMN profiles.used_invitations IS '用户已经使用的邀请次数';

-- 3. 在 system_settings 表中添加默认邀请次数设置
ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS default_max_invitations INTEGER DEFAULT 5;
COMMENT ON COLUMN system_settings.default_max_invitations IS '新用户的默认邀请次数上限';

-- 4. 更新 system_settings 表，添加默认值
UPDATE system_settings
SET default_max_invitations = 5
WHERE default_max_invitations IS NULL;

-- 5. 创建函数：获取用户剩余邀请次数
CREATE OR REPLACE FUNCTION get_remaining_invitations(user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  max_count INTEGER;
  used_count INTEGER;
BEGIN
  SELECT max_invitations, used_invitations
  INTO max_count, used_count
  FROM profiles
  WHERE id = user_id;

  IF max_count IS NULL THEN
    RETURN 0;
  END IF;

  RETURN GREATEST(max_count - COALESCE(used_count, 0), 0);
END;
$$;

COMMENT ON FUNCTION get_remaining_invitations IS '获取用户剩余的邀请次数';

-- 6. 创建函数：检查用户是否还可以邀请
CREATE OR REPLACE FUNCTION can_user_invite(user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN get_remaining_invitations(user_id) > 0;
END;
$$;

COMMENT ON FUNCTION can_user_invite IS '检查用户是否还有邀请次数';

-- 7. 创建触发器：在邀请记录创建时自动增加 used_invitations
CREATE OR REPLACE FUNCTION increment_used_invitations()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- 当邀请记录的状态变为 completed 时，增加邀请人的 used_invitations
  IF NEW.status = 'completed' AND (OLD IS NULL OR OLD.status != 'completed') THEN
    UPDATE profiles
    SET used_invitations = COALESCE(used_invitations, 0) + 1
    WHERE id = NEW.inviter_id;
  END IF;

  RETURN NEW;
END;
$$;

-- 删除旧的触发器（如果存在）
DROP TRIGGER IF EXISTS on_invitation_completed ON invitations;

-- 创建新的触发器
CREATE TRIGGER on_invitation_completed
  AFTER INSERT OR UPDATE ON invitations
  FOR EACH ROW
  WHEN (NEW.status = 'completed')
  EXECUTE FUNCTION increment_used_invitations();

-- 8. 修复现有数据：计算每个用户已使用的邀请次数
UPDATE profiles p
SET used_invitations = (
  SELECT COUNT(*)
  FROM invitations i
  WHERE i.inviter_id = p.id
    AND i.status = 'completed'
);

-- 9. 验证结果
DO $$
BEGIN
  RAISE NOTICE '✓ profiles 表已添加 max_invitations 和 used_invitations 字段';
  RAISE NOTICE '✓ system_settings 表已添加 default_max_invitations 字段';
  RAISE NOTICE '✓ 邀请次数查询函数已创建';
  RAISE NOTICE '✓ 邀请完成触发器已创建';
  RAISE NOTICE '✓ 现有数据已修复';
END $$;
