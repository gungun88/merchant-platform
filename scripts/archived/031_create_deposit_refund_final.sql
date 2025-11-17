-- =============================================
-- 最终版本：创建押金退还申请表（无RLS管理员策略）
-- =============================================

-- 1. 先删除可能存在的旧索引
DROP INDEX IF EXISTS public.idx_deposit_refund_merchant;
DROP INDEX IF EXISTS public.idx_deposit_refund_user;
DROP INDEX IF EXISTS public.idx_deposit_refund_status;
DROP INDEX IF EXISTS public.idx_deposit_refund_created;

-- 2. 创建表（如果不存在）
CREATE TABLE IF NOT EXISTS public.deposit_refund_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 关联信息
  merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- 押金信息
  deposit_amount DECIMAL(10, 2) NOT NULL,
  deposit_paid_at TIMESTAMP WITH TIME ZONE NOT NULL,
  refund_amount DECIMAL(10, 2) NOT NULL,
  fee_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
  fee_rate DECIMAL(5, 2) NOT NULL,

  -- 申请信息
  application_status TEXT NOT NULL DEFAULT 'pending',
  reason TEXT,

  -- 收款信息
  wallet_address TEXT NOT NULL,
  wallet_network TEXT NOT NULL,

  -- 审核信息
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  review_note TEXT,
  rejected_reason TEXT,

  -- 处理信息
  processed_by UUID REFERENCES auth.users(id),
  processed_at TIMESTAMP WITH TIME ZONE,
  transaction_hash TEXT,
  transaction_proof_url TEXT,

  -- 完成信息
  completed_at TIMESTAMP WITH TIME ZONE,
  completion_note TEXT,

  -- 时间戳
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  -- 约束
  CONSTRAINT valid_status CHECK (application_status IN ('pending', 'approved', 'processing', 'completed', 'rejected')),
  CONSTRAINT valid_amounts CHECK (deposit_amount > 0 AND refund_amount >= 0 AND fee_amount >= 0),
  CONSTRAINT valid_fee_rate CHECK (fee_rate >= 0 AND fee_rate <= 100),
  CONSTRAINT valid_wallet_network CHECK (wallet_network IN ('TRC20', 'ERC20', 'BEP20'))
);

-- 3. 创建索引
CREATE INDEX idx_deposit_refund_merchant ON public.deposit_refund_applications(merchant_id);
CREATE INDEX idx_deposit_refund_user ON public.deposit_refund_applications(user_id);
CREATE INDEX idx_deposit_refund_status ON public.deposit_refund_applications(application_status);
CREATE INDEX idx_deposit_refund_created ON public.deposit_refund_applications(created_at DESC);

-- 4. 创建或替换更新时间触发器函数
CREATE OR REPLACE FUNCTION update_deposit_refund_applications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. 删除旧触发器并创建新的
DROP TRIGGER IF EXISTS trigger_update_deposit_refund_applications_updated_at ON public.deposit_refund_applications;

CREATE TRIGGER trigger_update_deposit_refund_applications_updated_at
  BEFORE UPDATE ON public.deposit_refund_applications
  FOR EACH ROW
  EXECUTE FUNCTION update_deposit_refund_applications_updated_at();

-- 6. 添加表注释
COMMENT ON TABLE public.deposit_refund_applications IS '押金退还申请表';

-- 7. 启用 RLS（暂时禁用，之后手动在Supabase后台配置）
ALTER TABLE public.deposit_refund_applications ENABLE ROW LEVEL SECURITY;

-- 8. 删除所有旧策略
DROP POLICY IF EXISTS "商家可以查看自己的退还申请" ON public.deposit_refund_applications;
DROP POLICY IF EXISTS "商家可以创建自己的退还申请" ON public.deposit_refund_applications;
DROP POLICY IF EXISTS "商家可以更新pending状态的申请" ON public.deposit_refund_applications;
DROP POLICY IF EXISTS "管理员可以查看所有退还申请" ON public.deposit_refund_applications;
DROP POLICY IF EXISTS "管理员可以更新所有退还申请" ON public.deposit_refund_applications;

-- 9. 创建基本的 RLS 策略（只针对普通用户，管理员后续配置）
CREATE POLICY "商家可以查看自己的退还申请"
  ON public.deposit_refund_applications
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "商家可以创建自己的退还申请"
  ON public.deposit_refund_applications
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "商家可以更新pending状态的申请"
  ON public.deposit_refund_applications
  FOR UPDATE
  USING (auth.uid() = user_id AND application_status = 'pending');

-- 注意：管理员策略需要根据你的 profiles 表结构手动添加
-- 如果 profiles 表有 is_admin 或 role 字段，可以添加类似下面的策略：
-- CREATE POLICY "管理员可以查看所有退还申请"
--   ON public.deposit_refund_applications
--   FOR SELECT
--   USING (
--     EXISTS (
--       SELECT 1 FROM public.profiles
--       WHERE id = auth.uid() AND is_admin = true
--     )
--   );

-- 10. 更新 merchants 表，添加退还相关字段
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'merchants'
    AND column_name = 'deposit_refund_requested_at'
  ) THEN
    ALTER TABLE public.merchants
    ADD COLUMN deposit_refund_requested_at TIMESTAMP WITH TIME ZONE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'merchants'
    AND column_name = 'deposit_refund_completed_at'
  ) THEN
    ALTER TABLE public.merchants
    ADD COLUMN deposit_refund_completed_at TIMESTAMP WITH TIME ZONE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'merchants'
    AND column_name = 'deposit_refund_status'
  ) THEN
    ALTER TABLE public.merchants
    ADD COLUMN deposit_refund_status TEXT;
  END IF;
END $$;

-- =============================================
-- 脚本执行完成
-- =============================================

SELECT 'SUCCESS: deposit_refund_applications table ready!' as status;
