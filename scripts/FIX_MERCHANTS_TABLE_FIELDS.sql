-- ====================================================================
-- 修复 merchants 表缺失字段
-- 用途: 添加生产环境 merchants 表缺失的押金相关字段
-- ====================================================================

-- ============================================================
-- 第一步: 检查当前 merchants 表的所有列
-- ============================================================
SELECT
  '=== 当前 merchants 表的列 ===' AS info,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'merchants'
ORDER BY ordinal_position;

-- ============================================================
-- 第二步: 添加缺失的押金相关字段
-- ============================================================

-- 2.1 添加 deposit_bonus_claimed 字段（押金商家审核通过奖励是否已领取）
ALTER TABLE public.merchants
ADD COLUMN IF NOT EXISTS deposit_bonus_claimed BOOLEAN DEFAULT false;

-- 2.2 添加 deposit_refund_status 字段（押金退还状态）
ALTER TABLE public.merchants
ADD COLUMN IF NOT EXISTS deposit_refund_status VARCHAR(20) DEFAULT 'none'
CHECK (deposit_refund_status IN ('none', 'pending', 'completed', 'rejected'));

-- 2.3 添加 deposit_refund_requested_at 字段（押金退还申请时间）
ALTER TABLE public.merchants
ADD COLUMN IF NOT EXISTS deposit_refund_requested_at TIMESTAMPTZ;

-- 2.4 添加 deposit_refund_completed_at 字段（押金退还完成时间）
ALTER TABLE public.merchants
ADD COLUMN IF NOT EXISTS deposit_refund_completed_at TIMESTAMPTZ;

-- 2.5 确保 last_daily_login_reward_at 字段存在
ALTER TABLE public.merchants
ADD COLUMN IF NOT EXISTS last_daily_login_reward_at TIMESTAMPTZ;

-- ============================================================
-- 第三步: 添加字段注释
-- ============================================================
COMMENT ON COLUMN public.merchants.deposit_bonus_claimed IS '押金商家审核通过奖励是否已领取（一次性1000积分）';
COMMENT ON COLUMN public.merchants.deposit_refund_status IS '押金退还状态: none-未申请, pending-待审核, completed-已完成, rejected-已拒绝';
COMMENT ON COLUMN public.merchants.deposit_refund_requested_at IS '押金退还申请提交时间';
COMMENT ON COLUMN public.merchants.deposit_refund_completed_at IS '押金退还完成时间';
COMMENT ON COLUMN public.merchants.last_daily_login_reward_at IS '最后一次领取每日登录奖励的时间';

-- ============================================================
-- 第四步: 验证字段已添加
-- ============================================================
SELECT
  '=== 验证: 押金相关字段 ===' AS info,
  column_name,
  data_type,
  is_nullable,
  column_default,
  CASE
    WHEN column_name IN (
      'deposit_bonus_claimed',
      'deposit_refund_status',
      'deposit_refund_requested_at',
      'deposit_refund_completed_at',
      'last_daily_login_reward_at'
    ) THEN '✓ 已存在'
    ELSE ''
  END AS status
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'merchants'
  AND column_name IN (
    'is_deposit_merchant',
    'deposit_status',
    'deposit_amount',
    'deposit_paid_at',
    'deposit_bonus_claimed',
    'deposit_refund_status',
    'deposit_refund_requested_at',
    'deposit_refund_completed_at',
    'last_daily_login_reward_at'
  )
ORDER BY column_name;

-- 完成提示
SELECT
  '✓ merchants 表字段修复完成' AS status,
  '所有押金相关字段已添加' AS description,
  NOW() AS executed_at;
