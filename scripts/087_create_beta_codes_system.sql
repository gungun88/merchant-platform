-- 创建内测邀请码系统
-- 管理员可以批量生成内测邀请码，每个码只能使用一次

-- 0. 删除旧表和相关对象（如果存在）
DROP TABLE IF EXISTS beta_codes CASCADE;
DROP FUNCTION IF EXISTS validate_beta_code(TEXT) CASCADE;
DROP FUNCTION IF EXISTS use_beta_code(TEXT, UUID) CASCADE;

-- 1. 创建内测邀请码表
CREATE TABLE beta_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,  -- 邀请码（唯一随机生成）
  is_used BOOLEAN DEFAULT false,  -- 是否已使用
  used_by UUID REFERENCES profiles(id) ON DELETE SET NULL,  -- 使用者ID
  used_at TIMESTAMPTZ,  -- 使用时间
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,  -- 创建人（管理员）
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 添加表注释
COMMENT ON TABLE beta_codes IS '内测邀请码表';
COMMENT ON COLUMN beta_codes.code IS '邀请码（唯一随机生成）';
COMMENT ON COLUMN beta_codes.is_used IS '是否已使用';
COMMENT ON COLUMN beta_codes.used_by IS '使用者ID';
COMMENT ON COLUMN beta_codes.used_at IS '使用时间';
COMMENT ON COLUMN beta_codes.created_by IS '创建人（管理员）';

-- 3. 创建索引
CREATE INDEX IF NOT EXISTS idx_beta_codes_code ON beta_codes(code);
CREATE INDEX IF NOT EXISTS idx_beta_codes_is_used ON beta_codes(is_used);
CREATE INDEX IF NOT EXISTS idx_beta_codes_created_by ON beta_codes(created_by);
CREATE INDEX IF NOT EXISTS idx_beta_codes_used_by ON beta_codes(used_by);

-- 4. 启用 RLS
ALTER TABLE beta_codes ENABLE ROW LEVEL SECURITY;

-- 5. 创建 RLS 策略

-- 管理员可以查看所有内测码
CREATE POLICY "Admins can view all beta codes"
  ON beta_codes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- 管理员可以创建内测码
CREATE POLICY "Admins can create beta codes"
  ON beta_codes FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- 管理员可以更新内测码
CREATE POLICY "Admins can update beta codes"
  ON beta_codes FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- 管理员可以删除内测码
CREATE POLICY "Admins can delete beta codes"
  ON beta_codes FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- 6. 创建函数：验证内测码是否有效（供注册时调用）
CREATE OR REPLACE FUNCTION validate_beta_code(p_code TEXT)
RETURNS TABLE (
  is_valid BOOLEAN,
  beta_code_id UUID,
  error_message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_beta_code beta_codes%ROWTYPE;
BEGIN
  -- 查询内测码
  SELECT * INTO v_beta_code
  FROM beta_codes
  WHERE code = p_code;

  -- 内测码不存在
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::UUID, '邀请码不存在或无效'::TEXT;
    RETURN;
  END IF;

  -- 内测码已被使用
  IF v_beta_code.is_used THEN
    RETURN QUERY SELECT false, v_beta_code.id, '该邀请码已被使用'::TEXT;
    RETURN;
  END IF;

  -- 验证通过
  RETURN QUERY SELECT true, v_beta_code.id, NULL::TEXT;
END;
$$;

COMMENT ON FUNCTION validate_beta_code IS '验证内测码是否有效';

-- 7. 创建函数：标记内测码为已使用
CREATE OR REPLACE FUNCTION use_beta_code(
  p_code TEXT,
  p_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- 标记为已使用
  UPDATE beta_codes
  SET is_used = true,
      used_by = p_user_id,
      used_at = NOW()
  WHERE code = p_code
    AND is_used = false;  -- 确保只能使用一次

  RETURN FOUND;
EXCEPTION
  WHEN OTHERS THEN
    RETURN false;
END;
$$;

COMMENT ON FUNCTION use_beta_code IS '标记内测码为已使用';

-- 8. 验证结果
DO $$
BEGIN
  RAISE NOTICE '✓ beta_codes 表已创建';
  RAISE NOTICE '✓ 索引已添加';
  RAISE NOTICE '✓ RLS 策略已配置';
  RAISE NOTICE '✓ 内测码验证函数已创建';
  RAISE NOTICE '✓ 内测码使用函数已创建';
END $$;
