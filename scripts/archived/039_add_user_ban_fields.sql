-- 添加用户封禁相关字段到 profiles 表
-- 用于用户管理功能

-- 1. 添加封禁状态字段
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT FALSE NOT NULL;

-- 2. 添加封禁时间字段
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS banned_at TIMESTAMPTZ;

-- 3. 添加封禁原因字段
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS banned_reason TEXT;

-- 4. 添加封禁操作者字段
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS banned_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- 5. 添加积分字段（如果不存在）
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS points INTEGER DEFAULT 0 NOT NULL;

-- 6. 添加举报次数字段（如果不存在）
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS report_count INTEGER DEFAULT 0 NOT NULL;

-- 7. 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_profiles_is_banned ON public.profiles(is_banned);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_banned_by ON public.profiles(banned_by);

-- 8. 验证字段已添加
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'profiles'
  AND column_name IN ('is_banned', 'banned_at', 'banned_reason', 'banned_by', 'points', 'report_count')
ORDER BY column_name;

SELECT '✅ 用户封禁字段已添加' as status;
