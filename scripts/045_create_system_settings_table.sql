-- 创建系统设置表
CREATE TABLE IF NOT EXISTS system_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 基本配置
  platform_name TEXT DEFAULT '跨境服务商平台',
  platform_logo_url TEXT,
  platform_description TEXT DEFAULT '一个面向跨境电商服务商的展示和对接平台',

  -- 积分规则配置
  register_points INTEGER DEFAULT 100,
  invitation_points INTEGER DEFAULT 100,
  checkin_points INTEGER DEFAULT 5,
  checkin_7days_bonus INTEGER DEFAULT 20,
  checkin_30days_bonus INTEGER DEFAULT 50,
  merchant_register_points INTEGER DEFAULT 50,
  edit_merchant_cost INTEGER DEFAULT 100,
  view_contact_customer_cost INTEGER DEFAULT 10,
  view_contact_merchant_cost INTEGER DEFAULT 50,
  view_contact_merchant_deduct INTEGER DEFAULT 10, -- 被查看商家扣除的积分
  upload_avatar_reward INTEGER DEFAULT 30, -- 首次上传头像奖励
  deposit_merchant_daily_reward INTEGER DEFAULT 50, -- 押金商家每日登录奖励
  deposit_merchant_apply_reward INTEGER DEFAULT 1000, -- 押金商家申请通过一次性奖励
  merchant_top_cost_per_day INTEGER DEFAULT 1000, -- 商家置顶费用（积分/天）

  -- 押金配置
  deposit_refund_fee_rate DECIMAL(5,2) DEFAULT 5.00, -- 退还手续费率（百分比）
  deposit_violation_platform_rate DECIMAL(5,2) DEFAULT 30.00, -- 违规处罚平台抽成率
  deposit_violation_compensation_rate DECIMAL(5,2) DEFAULT 70.00, -- 违规处罚赔付率

  -- 信用分配置
  default_credit_score INTEGER DEFAULT 100,
  min_credit_score INTEGER DEFAULT 0,
  max_credit_score INTEGER DEFAULT 100,

  -- 安全配置
  max_login_attempts INTEGER DEFAULT 5,
  login_lockout_minutes INTEGER DEFAULT 30,
  session_timeout_hours INTEGER DEFAULT 24,

  -- 联系方式配置
  support_email TEXT,
  support_wechat TEXT,
  support_telegram TEXT,
  support_whatsapp TEXT,

  -- 时间戳
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id)
);

-- 创建更新时间触发器
CREATE OR REPLACE FUNCTION update_system_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_system_settings_updated_at_trigger
  BEFORE UPDATE ON system_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_system_settings_updated_at();

-- 插入默认配置（只有一条记录）
INSERT INTO system_settings (id)
VALUES ('00000000-0000-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;

-- 添加 RLS 策略
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- 所有人可以读取设置
CREATE POLICY "Anyone can read settings"
  ON system_settings
  FOR SELECT
  USING (true);

-- 只有管理员可以更新设置
CREATE POLICY "Only admins can update settings"
  ON system_settings
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- 添加注释
COMMENT ON TABLE system_settings IS '系统设置表（单例模式，只有一条记录）';
COMMENT ON COLUMN system_settings.platform_name IS '平台名称';
COMMENT ON COLUMN system_settings.register_points IS '注册奖励积分';
COMMENT ON COLUMN system_settings.invitation_points IS '邀请奖励积分';
COMMENT ON COLUMN system_settings.deposit_refund_fee_rate IS '押金退还手续费率（百分比）';
COMMENT ON COLUMN system_settings.default_credit_score IS '新商家默认信用分';
