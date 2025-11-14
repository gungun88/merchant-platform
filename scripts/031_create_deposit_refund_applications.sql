-- =============================================
-- 创建押金退还申请表
-- 创建时间: 2025-10-31
-- 说明: 用于管理押金商家的退还申请流程
-- =============================================

-- 1. 创建押金退还申请表
CREATE TABLE IF NOT EXISTS public.deposit_refund_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 关联信息
  merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- 押金信息
  deposit_amount DECIMAL(10, 2) NOT NULL, -- 原始押金金额
  deposit_paid_at TIMESTAMP WITH TIME ZONE NOT NULL, -- 押金缴纳时间
  refund_amount DECIMAL(10, 2) NOT NULL, -- 实际退还金额（扣除手续费后）
  fee_amount DECIMAL(10, 2) NOT NULL DEFAULT 0, -- 手续费金额
  fee_rate DECIMAL(5, 2) NOT NULL, -- 手续费率（如15或30）

  -- 申请信息
  application_status TEXT NOT NULL DEFAULT 'pending',
  -- pending: 待审核
  -- approved: 已批准（待打款）
  -- processing: 处理中（已打款）
  -- completed: 已完成
  -- rejected: 已拒绝

  reason TEXT, -- 退还原因

  -- 收款信息
  wallet_address TEXT NOT NULL, -- USDT钱包地址
  wallet_network TEXT NOT NULL, -- 网络类型（TRC20/ERC20等）

  -- 审核信息
  reviewed_by UUID REFERENCES auth.users(id), -- 审核人
  reviewed_at TIMESTAMP WITH TIME ZONE, -- 审核时间
  review_note TEXT, -- 审核备注
  rejected_reason TEXT, -- 拒绝原因

  -- 处理信息
  processed_by UUID REFERENCES auth.users(id), -- 处理人（打款操作人）
  processed_at TIMESTAMP WITH TIME ZONE, -- 处理时间
  transaction_hash TEXT, -- 交易哈希
  transaction_proof_url TEXT, -- 交易凭证URL

  -- 完成信息
  completed_at TIMESTAMP WITH TIME ZONE, -- 完成时间
  completion_note TEXT, -- 完成备注

  -- 时间戳
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  -- 约束
  CONSTRAINT valid_status CHECK (application_status IN ('pending', 'approved', 'processing', 'completed', 'rejected')),
  CONSTRAINT valid_amounts CHECK (deposit_amount > 0 AND refund_amount >= 0 AND fee_amount >= 0),
  CONSTRAINT valid_fee_rate CHECK (fee_rate >= 0 AND fee_rate <= 100),
  CONSTRAINT valid_wallet_network CHECK (wallet_network IN ('TRC20', 'ERC20', 'BEP20'))
);

-- 2. 创建索引
CREATE INDEX idx_deposit_refund_merchant ON public.deposit_refund_applications(merchant_id);
CREATE INDEX idx_deposit_refund_user ON public.deposit_refund_applications(user_id);
CREATE INDEX idx_deposit_refund_status ON public.deposit_refund_applications(application_status);
CREATE INDEX idx_deposit_refund_created ON public.deposit_refund_applications(created_at DESC);

-- 3. 创建更新时间触发器
CREATE OR REPLACE FUNCTION update_deposit_refund_applications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_deposit_refund_applications_updated_at
  BEFORE UPDATE ON public.deposit_refund_applications
  FOR EACH ROW
  EXECUTE FUNCTION update_deposit_refund_applications_updated_at();

-- 4. 添加表注释
COMMENT ON TABLE public.deposit_refund_applications IS '押金退还申请表';
COMMENT ON COLUMN public.deposit_refund_applications.merchant_id IS '商家ID';
COMMENT ON COLUMN public.deposit_refund_applications.user_id IS '用户ID';
COMMENT ON COLUMN public.deposit_refund_applications.deposit_amount IS '原始押金金额';
COMMENT ON COLUMN public.deposit_refund_applications.deposit_paid_at IS '押金缴纳时间';
COMMENT ON COLUMN public.deposit_refund_applications.refund_amount IS '实际退还金额（扣除手续费后）';
COMMENT ON COLUMN public.deposit_refund_applications.fee_amount IS '手续费金额';
COMMENT ON COLUMN public.deposit_refund_applications.fee_rate IS '手续费率（百分比）';
COMMENT ON COLUMN public.deposit_refund_applications.application_status IS '申请状态';
COMMENT ON COLUMN public.deposit_refund_applications.reason IS '退还原因';
COMMENT ON COLUMN public.deposit_refund_applications.wallet_address IS 'USDT钱包地址';
COMMENT ON COLUMN public.deposit_refund_applications.wallet_network IS '网络类型';
COMMENT ON COLUMN public.deposit_refund_applications.transaction_hash IS '交易哈希';

-- 5. 启用 RLS
ALTER TABLE public.deposit_refund_applications ENABLE ROW LEVEL SECURITY;

-- 6. 创建 RLS 策略

-- 商家可以查看自己的退还申请
CREATE POLICY "商家可以查看自己的退还申请"
  ON public.deposit_refund_applications
  FOR SELECT
  USING (auth.uid() = user_id);

-- 商家可以创建自己的退还申请
CREATE POLICY "商家可以创建自己的退还申请"
  ON public.deposit_refund_applications
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 商家可以更新pending状态的申请（撤回）
CREATE POLICY "商家可以更新pending状态的申请"
  ON public.deposit_refund_applications
  FOR UPDATE
  USING (auth.uid() = user_id AND application_status = 'pending');

-- 管理员可以查看所有申请
CREATE POLICY "管理员可以查看所有退还申请"
  ON public.deposit_refund_applications
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- 管理员可以更新所有申请
CREATE POLICY "管理员可以更新所有退还申请"
  ON public.deposit_refund_applications
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- 7. 更新 merchants 表，添加退还相关字段（如果还没有）
DO $$
BEGIN
  -- 检查并添加 deposit_refund_requested_at 字段
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'merchants'
    AND column_name = 'deposit_refund_requested_at'
  ) THEN
    ALTER TABLE public.merchants
    ADD COLUMN deposit_refund_requested_at TIMESTAMP WITH TIME ZONE;

    COMMENT ON COLUMN public.merchants.deposit_refund_requested_at IS '最后一次申请退还时间';
  END IF;

  -- 检查并添加 deposit_refund_completed_at 字段
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'merchants'
    AND column_name = 'deposit_refund_completed_at'
  ) THEN
    ALTER TABLE public.merchants
    ADD COLUMN deposit_refund_completed_at TIMESTAMP WITH TIME ZONE;

    COMMENT ON COLUMN public.merchants.deposit_refund_completed_at IS '退还完成时间';
  END IF;

  -- 检查并添加 deposit_refund_status 字段
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'merchants'
    AND column_name = 'deposit_refund_status'
  ) THEN
    ALTER TABLE public.merchants
    ADD COLUMN deposit_refund_status TEXT;

    COMMENT ON COLUMN public.merchants.deposit_refund_status IS '退还状态（none/pending/completed）';
  END IF;
END $$;

-- =============================================
-- 脚本执行完成
-- =============================================

-- 验证表创建
SELECT
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'deposit_refund_applications'
ORDER BY ordinal_position;
