-- 创建管理员操作日志表
CREATE TABLE IF NOT EXISTS admin_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action_type VARCHAR(50) NOT NULL, -- 操作类型: user_ban, user_unban, merchant_approve, merchant_reject, deposit_approve, deposit_reject, refund_approve, refund_reject, report_handle, partner_approve, partner_reject, announcement_create, announcement_update, announcement_delete, settings_update等
  target_type VARCHAR(50), -- 目标类型: user, merchant, deposit_application, refund_application, report, partner, announcement, settings
  target_id UUID, -- 目标ID
  old_data JSONB, -- 操作前的数据
  new_data JSONB, -- 操作后的数据
  description TEXT, -- 操作描述
  ip_address INET, -- IP地址
  user_agent TEXT, -- 用户代理
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_admin_logs_admin_id ON admin_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_logs_action_type ON admin_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_admin_logs_target_type ON admin_logs(target_type);
CREATE INDEX IF NOT EXISTS idx_admin_logs_target_id ON admin_logs(target_id);
CREATE INDEX IF NOT EXISTS idx_admin_logs_created_at ON admin_logs(created_at DESC);

-- 启用RLS
ALTER TABLE admin_logs ENABLE ROW LEVEL SECURITY;

-- 创建RLS策略: 只有管理员可以查看所有日志
CREATE POLICY "管理员可以查看所有日志"
  ON admin_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- 创建RLS策略: 系统可以插入日志(通过服务角色)
CREATE POLICY "系统可以插入日志"
  ON admin_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- 创建视图: 日志详情视图(包含管理员信息)
CREATE OR REPLACE VIEW admin_logs_with_details AS
SELECT
  al.id,
  al.admin_id,
  p.username AS admin_username,
  au.email AS admin_email,
  al.action_type,
  al.target_type,
  al.target_id,
  al.old_data,
  al.new_data,
  al.description,
  al.ip_address,
  al.user_agent,
  al.created_at
FROM admin_logs al
LEFT JOIN profiles p ON al.admin_id = p.id
LEFT JOIN auth.users au ON al.admin_id = au.id;

-- 授予视图查询权限
GRANT SELECT ON admin_logs_with_details TO authenticated;

COMMENT ON TABLE admin_logs IS '管理员操作日志表,记录所有管理后台的操作行为';
COMMENT ON COLUMN admin_logs.action_type IS '操作类型,如: user_ban, merchant_approve, deposit_approve等';
COMMENT ON COLUMN admin_logs.target_type IS '操作目标类型,如: user, merchant, deposit_application等';
COMMENT ON COLUMN admin_logs.target_id IS '操作目标的ID';
COMMENT ON COLUMN admin_logs.old_data IS '操作前的数据快照(JSON格式)';
COMMENT ON COLUMN admin_logs.new_data IS '操作后的数据快照(JSON格式)';
