-- ====================================================================
-- 综合修复脚本 - 修复所有已知的数据库问题
-- 执行日期: 2025-01-26
-- 用途: 一次性修复所有表结构、字段、约束等问题
-- ====================================================================

-- ============================================================
-- 第一部分: 修复 merchants 表 - 确保所有字段存在
-- ============================================================

-- 1.1 押金相关字段
ALTER TABLE public.merchants
ADD COLUMN IF NOT EXISTS is_deposit_merchant BOOLEAN DEFAULT false;

ALTER TABLE public.merchants
ADD COLUMN IF NOT EXISTS deposit_status VARCHAR(20) DEFAULT 'none'
CHECK (deposit_status IN ('none', 'pending', 'paid', 'frozen', 'violated'));

ALTER TABLE public.merchants
ADD COLUMN IF NOT EXISTS deposit_amount DECIMAL(10, 2) DEFAULT 0;

ALTER TABLE public.merchants
ADD COLUMN IF NOT EXISTS deposit_paid_at TIMESTAMPTZ;

ALTER TABLE public.merchants
ADD COLUMN IF NOT EXISTS deposit_bonus_claimed BOOLEAN DEFAULT false;

ALTER TABLE public.merchants
ADD COLUMN IF NOT EXISTS deposit_refund_status VARCHAR(20) DEFAULT 'none'
CHECK (deposit_refund_status IN ('none', 'pending', 'completed', 'rejected'));

ALTER TABLE public.merchants
ADD COLUMN IF NOT EXISTS deposit_refund_requested_at TIMESTAMPTZ;

ALTER TABLE public.merchants
ADD COLUMN IF NOT EXISTS deposit_refund_completed_at TIMESTAMPTZ;

-- 1.2 置顶相关字段
ALTER TABLE public.merchants
ADD COLUMN IF NOT EXISTS is_topped BOOLEAN DEFAULT false;

ALTER TABLE public.merchants
ADD COLUMN IF NOT EXISTS topped_until TIMESTAMPTZ;

ALTER TABLE public.merchants
ADD COLUMN IF NOT EXISTS pin_type VARCHAR(10) DEFAULT NULL;

ALTER TABLE public.merchants
ADD COLUMN IF NOT EXISTS pin_expires_at TIMESTAMPTZ;

-- 1.3 其他关键字段
ALTER TABLE public.merchants
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

ALTER TABLE public.merchants
ADD COLUMN IF NOT EXISTS views INTEGER DEFAULT 0;

ALTER TABLE public.merchants
ADD COLUMN IF NOT EXISTS last_daily_login_reward_at TIMESTAMPTZ;

ALTER TABLE public.merchants
ADD COLUMN IF NOT EXISTS credit_score INTEGER DEFAULT 100;

ALTER TABLE public.merchants
ADD COLUMN IF NOT EXISTS contact_phone TEXT;

-- 1.4 添加字段注释
COMMENT ON COLUMN public.merchants.is_deposit_merchant IS '是否为押金商家';
COMMENT ON COLUMN public.merchants.deposit_status IS '押金状态: none-未申请, pending-待审核, paid-已缴纳, frozen-冻结中, violated-违规扣除';
COMMENT ON COLUMN public.merchants.deposit_amount IS '当前押金金额(USDT)';
COMMENT ON COLUMN public.merchants.deposit_bonus_claimed IS '押金商家审核通过奖励是否已领取';
COMMENT ON COLUMN public.merchants.deposit_refund_status IS '押金退还状态: none-未申请, pending-待审核, completed-已完成, rejected-已拒绝';
COMMENT ON COLUMN public.merchants.pin_type IS '置顶类型: null(未置顶), self(自助置顶), admin(官方置顶)';
COMMENT ON COLUMN public.merchants.pin_expires_at IS '置顶到期时间';
COMMENT ON COLUMN public.merchants.is_active IS '商家是否上架';
COMMENT ON COLUMN public.merchants.credit_score IS '商家信用分(100分制)';

-- ============================================================
-- 第二部分: 修复 profiles 表 - 确保所有字段存在
-- ============================================================

-- 2.1 用户基本字段
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS user_number INTEGER UNIQUE;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS points INTEGER DEFAULT 0;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS is_merchant BOOLEAN DEFAULT false;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS invitation_code TEXT UNIQUE;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS invited_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 2.2 角色权限字段
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'user'
CHECK (role IN ('user', 'admin', 'super_admin'));

-- 2.3 邀请限制字段
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS max_invitations INTEGER DEFAULT 5;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS used_invitations INTEGER DEFAULT 0;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS last_invitation_reset_at TIMESTAMPTZ DEFAULT NOW();

-- 2.4 签到相关字段
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS last_checkin_at TIMESTAMPTZ;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS checkin_streak INTEGER DEFAULT 0;

-- 2.5 其他字段
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS email TEXT;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS report_count INTEGER DEFAULT 0;

-- 2.6 添加字段注释
COMMENT ON COLUMN public.profiles.user_number IS '用户编号(唯一)';
COMMENT ON COLUMN public.profiles.points IS '用户积分';
COMMENT ON COLUMN public.profiles.role IS '用户角色: user-普通用户, admin-管理员, super_admin-超级管理员';
COMMENT ON COLUMN public.profiles.invitation_code IS '用户的邀请码';
COMMENT ON COLUMN public.profiles.invited_by IS '邀请人ID';
COMMENT ON COLUMN public.profiles.max_invitations IS '最大邀请次数';
COMMENT ON COLUMN public.profiles.used_invitations IS '已使用邀请次数';

-- ============================================================
-- 第三部分: 创建缺失的表
-- ============================================================

-- 3.1 管理员操作日志表
CREATE TABLE IF NOT EXISTS public.admin_operation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  operation_type TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id UUID,
  description TEXT NOT NULL,
  metadata JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_logs_admin_id ON public.admin_operation_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_logs_created_at ON public.admin_operation_logs(created_at DESC);

-- 3.2 押金追加申请表
CREATE TABLE IF NOT EXISTS public.deposit_top_up_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  original_amount DECIMAL(10, 2) NOT NULL,
  top_up_amount DECIMAL(10, 2) NOT NULL CHECK (top_up_amount > 0),
  total_amount DECIMAL(10, 2) NOT NULL,
  transaction_hash TEXT,
  payment_proof_url TEXT,
  application_status VARCHAR(20) DEFAULT 'pending' CHECK (application_status IN ('pending', 'approved', 'rejected')),
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deposit_top_up_merchant_id ON public.deposit_top_up_applications(merchant_id);
CREATE INDEX IF NOT EXISTS idx_deposit_top_up_status ON public.deposit_top_up_applications(application_status);

-- 3.3 用户通知表
CREATE TABLE IF NOT EXISTS public.user_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_notifications_user_id ON public.user_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_user_notifications_created_at ON public.user_notifications(created_at DESC);

-- ============================================================
-- 第四部分: 修复约束和索引
-- ============================================================

-- 4.1 为 merchants 表创建索引
CREATE INDEX IF NOT EXISTS idx_merchants_pin_type ON merchants(pin_type);
CREATE INDEX IF NOT EXISTS idx_merchants_pin_expires_at ON merchants(pin_expires_at);
CREATE INDEX IF NOT EXISTS idx_merchants_is_active ON merchants(is_active);
CREATE INDEX IF NOT EXISTS idx_merchants_is_deposit_merchant ON merchants(is_deposit_merchant);
CREATE INDEX IF NOT EXISTS idx_merchants_user_id ON merchants(user_id);

-- 4.2 为 profiles 表创建索引
CREATE INDEX IF NOT EXISTS idx_profiles_user_number ON profiles(user_number);
CREATE INDEX IF NOT EXISTS idx_profiles_invitation_code ON profiles(invitation_code);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);

-- ============================================================
-- 第五部分: 启用 RLS（如果未启用）
-- ============================================================

ALTER TABLE public.merchants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_operation_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deposit_top_up_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 第六部分: 数据迁移和修复
-- ============================================================

-- 6.1 迁移旧的置顶数据到新的 pin_type 字段
UPDATE merchants
SET
  pin_type = 'self',
  pin_expires_at = topped_until
WHERE is_topped = true
  AND pin_type IS NULL
  AND topped_until IS NOT NULL;

-- 6.2 确保所有商家都有 is_active 字段（默认为 true）
UPDATE merchants
SET is_active = true
WHERE is_active IS NULL;

-- 6.3 确保所有用户都有 points 字段（默认为 0）
UPDATE profiles
SET points = 0
WHERE points IS NULL;

-- 6.4 确保所有用户都有 role 字段（默认为 'user'）
UPDATE profiles
SET role = 'user'
WHERE role IS NULL;

-- 6.5 为没有用户编号的用户生成编号
DO $$
DECLARE
  profile_record RECORD;
  next_number INTEGER;
BEGIN
  -- 获取当前最大用户编号
  SELECT COALESCE(MAX(user_number), 100000) + 1 INTO next_number FROM profiles;

  -- 为没有用户编号的用户分配编号
  FOR profile_record IN
    SELECT id FROM profiles WHERE user_number IS NULL ORDER BY created_at
  LOOP
    UPDATE profiles SET user_number = next_number WHERE id = profile_record.id;
    next_number := next_number + 1;
  END LOOP;
END $$;

-- ============================================================
-- 第七部分: 验证修复结果
-- ============================================================

-- 7.1 验证 merchants 表关键字段
SELECT
  '=== merchants 表字段验证 ===' AS info,
  COUNT(*) AS total_merchants,
  COUNT(CASE WHEN is_deposit_merchant IS NOT NULL THEN 1 END) AS has_is_deposit_merchant,
  COUNT(CASE WHEN deposit_status IS NOT NULL THEN 1 END) AS has_deposit_status,
  COUNT(CASE WHEN pin_type IS NOT NULL THEN 1 END) AS has_pin_type,
  COUNT(CASE WHEN is_active IS NOT NULL THEN 1 END) AS has_is_active
FROM merchants;

-- 7.2 验证 profiles 表关键字段
SELECT
  '=== profiles 表字段验证 ===' AS info,
  COUNT(*) AS total_users,
  COUNT(CASE WHEN user_number IS NOT NULL THEN 1 END) AS has_user_number,
  COUNT(CASE WHEN points IS NOT NULL THEN 1 END) AS has_points,
  COUNT(CASE WHEN role IS NOT NULL THEN 1 END) AS has_role
FROM profiles;

-- 7.3 验证关键表是否存在
SELECT
  '=== 关键表验证 ===' AS info,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'merchants') THEN '✓' ELSE '✗' END AS merchants,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'profiles') THEN '✓' ELSE '✗' END AS profiles,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'admin_operation_logs') THEN '✓' ELSE '✗' END AS admin_operation_logs,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'deposit_top_up_applications') THEN '✓' ELSE '✗' END AS deposit_top_up_applications,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_notifications') THEN '✓' ELSE '✗' END AS user_notifications;

-- 完成提示
SELECT
  '✓ 综合修复完成' AS status,
  '所有表结构和字段已修复' AS description,
  NOW() AS executed_at;

-- 刷新 schema cache
NOTIFY pgrst, 'reload schema';
