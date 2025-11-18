-- =============================================
-- 生产环境热修复脚本
-- 包含所有被归档但仍然需要的字段和函数
-- =============================================

-- 1. 添加用户封禁相关字段 (来自 039_add_user_ban_fields.sql)
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT FALSE NOT NULL;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS banned_at TIMESTAMPTZ;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS banned_reason TEXT;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS banned_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS report_count INTEGER DEFAULT 0 NOT NULL;

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_profiles_is_banned ON public.profiles(is_banned);

-- 2. 确保签到字段存在 (来自 023_add_checkin_fields_to_profiles.sql)
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS last_checkin TIMESTAMP WITH TIME ZONE;

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS consecutive_checkin_days INTEGER DEFAULT 0;

-- 为现有用户设置默认值
UPDATE profiles
SET consecutive_checkin_days = 0
WHERE consecutive_checkin_days IS NULL;

-- 3. 确保积分记录函数存在 (来自 022_create_point_transactions_table.sql)
CREATE OR REPLACE FUNCTION public.record_point_transaction(
  p_user_id UUID,
  p_amount INTEGER,
  p_type TEXT,
  p_description TEXT,
  p_related_user_id UUID DEFAULT NULL,
  p_related_merchant_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_points INTEGER;
  v_transaction_id UUID;
BEGIN
  -- 获取当前积分
  SELECT points INTO v_current_points
  FROM public.profiles
  WHERE id = p_user_id;

  IF v_current_points IS NULL THEN
    RAISE EXCEPTION 'User profile not found';
  END IF;

  -- 插入交易记录
  INSERT INTO public.point_transactions (
    user_id,
    amount,
    balance_after,
    type,
    description,
    related_user_id,
    related_merchant_id,
    metadata
  ) VALUES (
    p_user_id,
    p_amount,
    v_current_points + p_amount,
    p_type,
    p_description,
    p_related_user_id,
    p_related_merchant_id,
    p_metadata
  )
  RETURNING id INTO v_transaction_id;

  RETURN v_transaction_id;
END;
$$;

-- 4. 创建 now() 包装函数
CREATE OR REPLACE FUNCTION public.now()
RETURNS timestamptz
LANGUAGE sql
STABLE
AS $$
  SELECT now();
$$;

-- 5. 授权
GRANT EXECUTE ON FUNCTION public.record_point_transaction TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.now() TO authenticated, anon, service_role;

-- 6. 验证
SELECT '✅ 生产环境热修复完成' as status;

-- 验证所有必要字段都存在
SELECT
  column_name,
  data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'profiles'
  AND column_name IN (
    'is_banned',
    'banned_at',
    'banned_reason',
    'banned_by',
    'report_count',
    'last_checkin',
    'consecutive_checkin_days'
  )
ORDER BY column_name;
