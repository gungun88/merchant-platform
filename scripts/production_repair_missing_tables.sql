-- ====================================================================
-- 生产环境数据库修复脚本 - 补充缺失的表
-- 用途: 安全地添加生产环境缺失的2个表及其相关对象
-- 缺失的表:
--   1. admin_operation_logs (管理员操作日志表)
--   2. deposit_top_up_applications (押金追加申请表)
--
-- 执行前注意:
--   1. 此脚本使用 IF NOT EXISTS 语法，可以安全重复执行
--   2. 不会影响现有数据
--   3. 只会创建缺失的对象
-- ====================================================================

-- ============================================================
-- 第一部分: 创建 admin_operation_logs 表及相关对象
-- ============================================================

-- 1.1 创建管理员操作日志表
CREATE TABLE IF NOT EXISTS public.admin_operation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  operation_type TEXT NOT NULL, -- 操作类型: approve_merchant, reject_deposit, ban_user 等
  target_type TEXT NOT NULL, -- 目标类型: merchant, user, deposit_application 等
  target_id UUID, -- 目标ID
  description TEXT NOT NULL, -- 操作描述
  metadata JSONB, -- 额外的元数据
  ip_address TEXT, -- 操作IP地址
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 1.2 为管理员操作日志创建索引
CREATE INDEX IF NOT EXISTS idx_admin_logs_admin_id ON public.admin_operation_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_logs_created_at ON public.admin_operation_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_logs_operation_type ON public.admin_operation_logs(operation_type);

-- 1.3 启用 RLS
ALTER TABLE public.admin_operation_logs ENABLE ROW LEVEL SECURITY;

-- 1.4 删除旧的 RLS 策略（如果存在）
DROP POLICY IF EXISTS "管理员可以查看所有操作日志" ON public.admin_operation_logs;
DROP POLICY IF EXISTS "管理员可以创建操作日志" ON public.admin_operation_logs;

-- 1.5 创建 RLS 策略 - 只有管理员可以查看日志
CREATE POLICY "管理员可以查看所有操作日志"
  ON public.admin_operation_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- 1.6 创建 RLS 策略 - 只有管理员可以创建日志
CREATE POLICY "管理员可以创建操作日志"
  ON public.admin_operation_logs
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- 1.7 添加表注释
COMMENT ON TABLE public.admin_operation_logs IS '管理员操作日志表';
COMMENT ON COLUMN public.admin_operation_logs.operation_type IS '操作类型: approve_merchant, reject_deposit, ban_user 等';
COMMENT ON COLUMN public.admin_operation_logs.target_type IS '目标类型: merchant, user, deposit_application 等';

-- ============================================================
-- 第二部分: 创建 deposit_top_up_applications 表及相关对象
-- ============================================================

-- 2.1 创建押金追加申请表
CREATE TABLE IF NOT EXISTS public.deposit_top_up_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
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

-- 2.2 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_deposit_top_up_merchant_id ON public.deposit_top_up_applications(merchant_id);
CREATE INDEX IF NOT EXISTS idx_deposit_top_up_user_id ON public.deposit_top_up_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_deposit_top_up_status ON public.deposit_top_up_applications(application_status);
CREATE INDEX IF NOT EXISTS idx_deposit_top_up_created_at ON public.deposit_top_up_applications(created_at DESC);

-- 2.3 启用RLS
ALTER TABLE public.deposit_top_up_applications ENABLE ROW LEVEL SECURITY;

-- 2.4 删除旧的 RLS 策略（如果存在）
DROP POLICY IF EXISTS "用户可以查看自己的追加申请" ON public.deposit_top_up_applications;
DROP POLICY IF EXISTS "用户可以创建追加申请" ON public.deposit_top_up_applications;
DROP POLICY IF EXISTS "管理员可以查看所有追加申请" ON public.deposit_top_up_applications;
DROP POLICY IF EXISTS "管理员可以更新追加申请" ON public.deposit_top_up_applications;

-- 2.5 创建RLS策略: 用户可以查看自己的追加申请
CREATE POLICY "用户可以查看自己的追加申请"
  ON public.deposit_top_up_applications
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- 2.6 创建RLS策略: 用户可以创建追加申请
CREATE POLICY "用户可以创建追加申请"
  ON public.deposit_top_up_applications
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- 2.7 创建RLS策略: 管理员可以查看所有追加申请
CREATE POLICY "管理员可以查看所有追加申请"
  ON public.deposit_top_up_applications
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- 2.8 创建RLS策略: 管理员可以更新追加申请
CREATE POLICY "管理员可以更新追加申请"
  ON public.deposit_top_up_applications
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- 2.9 创建更新时间戳触发器函数
CREATE OR REPLACE FUNCTION public.update_deposit_top_up_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2.10 删除旧的触发器（如果存在）
DROP TRIGGER IF EXISTS trigger_update_deposit_top_up_updated_at ON public.deposit_top_up_applications;

-- 2.11 创建更新时间戳触发器
CREATE TRIGGER trigger_update_deposit_top_up_updated_at
  BEFORE UPDATE ON public.deposit_top_up_applications
  FOR EACH ROW
  EXECUTE FUNCTION update_deposit_top_up_updated_at();

-- 2.12 添加表注释
COMMENT ON TABLE public.deposit_top_up_applications IS '押金追加申请表,记录商家追加押金的申请';
COMMENT ON COLUMN public.deposit_top_up_applications.original_amount IS '申请时的原有押金金额';
COMMENT ON COLUMN public.deposit_top_up_applications.top_up_amount IS '本次追加的押金金额';
COMMENT ON COLUMN public.deposit_top_up_applications.total_amount IS '追加后的累计押金金额';
COMMENT ON COLUMN public.deposit_top_up_applications.application_status IS '申请状态: pending-待审核, approved-已通过, rejected-已拒绝';

-- ============================================================
-- 第三部分: 创建视图（可选，用于方便查询）
-- ============================================================

-- 3.1 删除旧视图（如果存在）
DROP VIEW IF EXISTS public.deposit_top_up_applications_with_details;

-- 3.2 创建押金追加申请详情视图
CREATE OR REPLACE VIEW public.deposit_top_up_applications_with_details AS
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
  p.username AS applicant_username
FROM public.deposit_top_up_applications dta
LEFT JOIN public.merchants m ON dta.merchant_id = m.id
LEFT JOIN public.profiles p ON dta.user_id = p.id;

-- 3.3 授予视图查询权限
GRANT SELECT ON public.deposit_top_up_applications_with_details TO authenticated;

-- ============================================================
-- 验证：检查表是否创建成功
-- ============================================================

DO $$
DECLARE
  admin_logs_exists BOOLEAN;
  top_up_exists BOOLEAN;
BEGIN
  -- 检查 admin_operation_logs 表
  SELECT EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'admin_operation_logs'
  ) INTO admin_logs_exists;

  -- 检查 deposit_top_up_applications 表
  SELECT EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'deposit_top_up_applications'
  ) INTO top_up_exists;

  -- 输出结果
  RAISE NOTICE '========================================';
  RAISE NOTICE '生产环境数据库修复完成！';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'admin_operation_logs 表: %', CASE WHEN admin_logs_exists THEN '✓ 已创建' ELSE '✗ 创建失败' END;
  RAISE NOTICE 'deposit_top_up_applications 表: %', CASE WHEN top_up_exists THEN '✓ 已创建' ELSE '✗ 创建失败' END;
  RAISE NOTICE '========================================';

  IF admin_logs_exists AND top_up_exists THEN
    RAISE NOTICE '所有缺失的表已成功创建！';
  ELSE
    RAISE WARNING '部分表创建失败，请检查错误日志';
  END IF;
END $$;

-- 完成提示
SELECT
  '✓ 生产环境数据库修复脚本执行完成' AS status,
  '已添加 2 个缺失的表及相关对象' AS description,
  NOW() AS executed_at;
