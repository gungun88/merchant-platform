-- 创建押金追加申请表
CREATE TABLE IF NOT EXISTS deposit_top_up_applications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- 押金金额信息
  original_amount DECIMAL(10, 2) NOT NULL, -- 原有押金金额
  top_up_amount DECIMAL(10, 2) NOT NULL CHECK (top_up_amount > 0), -- 追加金额
  total_amount DECIMAL(10, 2) NOT NULL, -- 累计金额(原有+追加)

  -- 支付信息
  transaction_hash TEXT, -- 交易哈希/交易ID
  payment_proof_url TEXT, -- 支付凭证URL

  -- 审核信息
  application_status VARCHAR(20) DEFAULT 'pending' CHECK (application_status IN ('pending', 'approved', 'rejected')),
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- 审核人
  approved_at TIMESTAMPTZ, -- 审核时间
  rejection_reason TEXT, -- 拒绝原因

  -- 时间戳
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_deposit_top_up_merchant_id ON deposit_top_up_applications(merchant_id);
CREATE INDEX IF NOT EXISTS idx_deposit_top_up_user_id ON deposit_top_up_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_deposit_top_up_status ON deposit_top_up_applications(application_status);
CREATE INDEX IF NOT EXISTS idx_deposit_top_up_created_at ON deposit_top_up_applications(created_at DESC);

-- 启用RLS
ALTER TABLE deposit_top_up_applications ENABLE ROW LEVEL SECURITY;

-- 创建RLS策略: 用户可以查看自己的追加申请
CREATE POLICY "用户可以查看自己的追加申请"
  ON deposit_top_up_applications
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- 创建RLS策略: 用户可以创建追加申请
CREATE POLICY "用户可以创建追加申请"
  ON deposit_top_up_applications
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- 创建RLS策略: 管理员可以查看所有追加申请
CREATE POLICY "管理员可以查看所有追加申请"
  ON deposit_top_up_applications
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- 创建RLS策略: 管理员可以更新追加申请
CREATE POLICY "管理员可以更新追加申请"
  ON deposit_top_up_applications
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- 创建视图: 追加申请详情视图(包含商家和用户信息)
CREATE OR REPLACE VIEW deposit_top_up_applications_with_details AS
SELECT
  dta.id,
  dta.merchant_id,
  dta.user_id,
  dta.original_amount,
  dta.top_up_amount,
  dta.total_amount,
  dta.transaction_hash,
  dta.payment_proof_url,
  dta.application_status,
  dta.approved_by,
  dta.approved_at,
  dta.rejection_reason,
  dta.created_at,
  dta.updated_at,
  -- 商家信息
  m.name AS merchant_name,
  m.logo AS merchant_logo,
  m.deposit_amount AS merchant_current_deposit,
  -- 申请人信息
  p.username AS applicant_username,
  au.email AS applicant_email,
  -- 审核人信息
  ap.username AS approver_username,
  apu.email AS approver_email
FROM deposit_top_up_applications dta
LEFT JOIN merchants m ON dta.merchant_id = m.id
LEFT JOIN profiles p ON dta.user_id = p.id
LEFT JOIN auth.users au ON dta.user_id = au.id
LEFT JOIN profiles ap ON dta.approved_by = ap.id
LEFT JOIN auth.users apu ON dta.approved_by = apu.id;

-- 授予视图查询权限
GRANT SELECT ON deposit_top_up_applications_with_details TO authenticated;

-- 创建更新时间戳触发器
CREATE OR REPLACE FUNCTION update_deposit_top_up_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_deposit_top_up_updated_at
  BEFORE UPDATE ON deposit_top_up_applications
  FOR EACH ROW
  EXECUTE FUNCTION update_deposit_top_up_updated_at();

COMMENT ON TABLE deposit_top_up_applications IS '押金追加申请表,记录商家追加押金的申请';
COMMENT ON COLUMN deposit_top_up_applications.original_amount IS '申请时的原有押金金额';
COMMENT ON COLUMN deposit_top_up_applications.top_up_amount IS '本次追加的押金金额';
COMMENT ON COLUMN deposit_top_up_applications.total_amount IS '追加后的累计押金金额';
COMMENT ON COLUMN deposit_top_up_applications.application_status IS '申请状态: pending-待审核, approved-已通过, rejected-已拒绝';
