-- =============================================
-- 押金商家系统数据库迁移脚本
-- 创建时间: 2025-10-30
-- 说明: 添加押金商家相关字段和功能
-- =============================================

-- 1. 添加押金商家相关字段到 merchants 表
ALTER TABLE merchants
ADD COLUMN IF NOT EXISTS is_deposit_merchant BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS deposit_amount DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS deposit_status VARCHAR(20) DEFAULT 'unpaid',
ADD COLUMN IF NOT EXISTS deposit_paid_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS deposit_refund_requested_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS deposit_refund_completed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS deposit_refund_fee_percentage INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_daily_login_reward_at TIMESTAMPTZ;

-- 2. 添加字段注释
COMMENT ON COLUMN merchants.is_deposit_merchant IS '是否为押金商家';
COMMENT ON COLUMN merchants.deposit_amount IS '押金金额(USDT)';
COMMENT ON COLUMN merchants.deposit_status IS '押金状态: unpaid(未缴纳), paid(已缴纳), refund_requested(申请退还), refunded(已退还), violated(违规扣除)';
COMMENT ON COLUMN merchants.deposit_paid_at IS '押金缴纳时间';
COMMENT ON COLUMN merchants.deposit_refund_requested_at IS '押金退还申请时间';
COMMENT ON COLUMN merchants.deposit_refund_completed_at IS '押金退还完成时间';
COMMENT ON COLUMN merchants.deposit_refund_fee_percentage IS '退还时收取的手续费百分比(0-100)';
COMMENT ON COLUMN merchants.last_daily_login_reward_at IS '最后一次领取每日登录奖励的时间';

-- 3. 创建押金商家申请记录表
CREATE TABLE IF NOT EXISTS deposit_merchant_applications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    deposit_amount DECIMAL(10, 2) NOT NULL DEFAULT 500.00,
    payment_proof_url TEXT, -- 支付凭证URL
    application_status VARCHAR(20) DEFAULT 'pending', -- pending(待审核), approved(已批准), rejected(已拒绝)
    admin_note TEXT, -- 管理员备注
    approved_by UUID REFERENCES auth.users(id),
    approved_at TIMESTAMPTZ,
    rejected_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE deposit_merchant_applications IS '押金商家申请记录表';
COMMENT ON COLUMN deposit_merchant_applications.application_status IS '申请状态: pending(待审核), approved(已批准), rejected(已拒绝)';

-- 4. 创建押金退还申请记录表
CREATE TABLE IF NOT EXISTS deposit_refund_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    original_deposit_amount DECIMAL(10, 2) NOT NULL,
    refund_fee_percentage INTEGER NOT NULL, -- 手续费百分比
    refund_fee_amount DECIMAL(10, 2) NOT NULL, -- 手续费金额
    refund_amount DECIMAL(10, 2) NOT NULL, -- 实际退还金额
    refund_account_info TEXT, -- 退款账户信息
    request_status VARCHAR(20) DEFAULT 'pending', -- pending(待处理), approved(已批准), rejected(已拒绝), completed(已完成)
    admin_note TEXT,
    approved_by UUID REFERENCES auth.users(id),
    approved_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    rejected_reason TEXT,
    deposit_paid_duration_days INTEGER, -- 押金缴纳天数
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE deposit_refund_requests IS '押金退还申请记录表';
COMMENT ON COLUMN deposit_refund_requests.request_status IS '退还状态: pending(待处理), approved(已批准), rejected(已拒绝), completed(已完成)';

-- 5. 创建押金违规处理记录表
CREATE TABLE IF NOT EXISTS deposit_violation_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    violation_type VARCHAR(50) NOT NULL, -- 违规类型
    violation_description TEXT NOT NULL, -- 违规描述
    original_deposit_amount DECIMAL(10, 2) NOT NULL,
    platform_deduction_amount DECIMAL(10, 2) NOT NULL, -- 平台扣除金额(30%)
    victim_compensation_amount DECIMAL(10, 2) NOT NULL, -- 受害者补偿金额(70%)
    victim_user_ids UUID[], -- 受害者用户ID列表
    evidence_urls TEXT[], -- 证据URL列表
    processed_by UUID REFERENCES auth.users(id), -- 处理人
    processed_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE deposit_violation_records IS '押金违规处理记录表';

-- 6. 创建每日登录奖励记录表
CREATE TABLE IF NOT EXISTS daily_login_rewards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    merchant_id UUID REFERENCES merchants(id) ON DELETE SET NULL,
    is_deposit_merchant BOOLEAN DEFAULT FALSE,
    reward_points INTEGER NOT NULL, -- 奖励积分(押金商家50分, 普通用户可能不同)
    login_date DATE NOT NULL, -- 登录日期
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, login_date) -- 每天只能领取一次
);

COMMENT ON TABLE daily_login_rewards IS '每日登录奖励记录表';
CREATE INDEX IF NOT EXISTS idx_daily_login_rewards_user_date ON daily_login_rewards(user_id, login_date);

-- 7. 为押金商家相关表创建索引
CREATE INDEX IF NOT EXISTS idx_merchants_is_deposit_merchant ON merchants(is_deposit_merchant);
CREATE INDEX IF NOT EXISTS idx_merchants_deposit_status ON merchants(deposit_status);
CREATE INDEX IF NOT EXISTS idx_deposit_applications_status ON deposit_merchant_applications(application_status);
CREATE INDEX IF NOT EXISTS idx_deposit_applications_merchant ON deposit_merchant_applications(merchant_id);
CREATE INDEX IF NOT EXISTS idx_deposit_refund_status ON deposit_refund_requests(request_status);
CREATE INDEX IF NOT EXISTS idx_deposit_refund_merchant ON deposit_refund_requests(merchant_id);
CREATE INDEX IF NOT EXISTS idx_deposit_violation_merchant ON deposit_violation_records(merchant_id);

-- 8. 启用行级安全策略 (RLS)
ALTER TABLE deposit_merchant_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE deposit_refund_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE deposit_violation_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_login_rewards ENABLE ROW LEVEL SECURITY;

-- 9. 创建 RLS 策略 - 押金商家申请表
-- 用户可以查看自己的申请
CREATE POLICY "Users can view own deposit applications"
ON deposit_merchant_applications FOR SELECT
USING (auth.uid() = user_id);

-- 用户可以创建自己的申请
CREATE POLICY "Users can create own deposit applications"
ON deposit_merchant_applications FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- 用户可以更新自己待审核的申请
CREATE POLICY "Users can update own pending applications"
ON deposit_merchant_applications FOR UPDATE
USING (auth.uid() = user_id AND application_status = 'pending');

-- 10. 创建 RLS 策略 - 押金退还申请表
-- 用户可以查看自己的退还申请
CREATE POLICY "Users can view own refund requests"
ON deposit_refund_requests FOR SELECT
USING (auth.uid() = user_id);

-- 用户可以创建自己的退还申请
CREATE POLICY "Users can create own refund requests"
ON deposit_refund_requests FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- 11. 创建 RLS 策略 - 违规记录表
-- 用户可以查看与自己相关的违规记录
CREATE POLICY "Users can view own violation records"
ON deposit_violation_records FOR SELECT
USING (auth.uid() = user_id OR auth.uid() = ANY(victim_user_ids));

-- 12. 创建 RLS 策略 - 每日登录奖励表
-- 用户可以查看自己的登录奖励记录
CREATE POLICY "Users can view own login rewards"
ON daily_login_rewards FOR SELECT
USING (auth.uid() = user_id);

-- 用户可以创建自己的登录奖励记录
CREATE POLICY "Users can create own login rewards"
ON daily_login_rewards FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- 13. 创建自动更新 updated_at 的触发器函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 14. 为相关表添加 updated_at 自动更新触发器
CREATE TRIGGER update_deposit_applications_updated_at
    BEFORE UPDATE ON deposit_merchant_applications
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_deposit_refunds_updated_at
    BEFORE UPDATE ON deposit_refund_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 15. 插入一些测试数据（可选，用于测试）
-- 将第一个商家设置为押金商家用于测试
-- UPDATE merchants
-- SET is_deposit_merchant = TRUE,
--     deposit_amount = 500.00,
--     deposit_status = 'paid',
--     deposit_paid_at = NOW()
-- WHERE id = (SELECT id FROM merchants LIMIT 1);

-- =============================================
-- 脚本执行完成
-- =============================================

-- 验证脚本执行结果
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'merchants'
AND column_name IN (
    'is_deposit_merchant',
    'deposit_amount',
    'deposit_status',
    'deposit_paid_at',
    'last_daily_login_reward_at'
)
ORDER BY column_name;
