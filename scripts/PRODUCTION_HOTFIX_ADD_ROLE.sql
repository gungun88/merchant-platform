-- =============================================
-- 生产环境热修复：添加 role 字段
-- 执行日期: 2025-11-18
-- 说明: 在生产环境中为 profiles 表添加缺失的 role 字段
-- =============================================

-- 1. 添加 role 字段
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'user' NOT NULL;

-- 2. 添加检查约束
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profiles_role_check'
    AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_role_check
    CHECK (role IN ('user', 'merchant', 'admin', 'super_admin'));
  END IF;
END $$;

-- 3. 创建索引以提升查询性能
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

-- 4. 添加字段注释
COMMENT ON COLUMN public.profiles.role IS '用户角色: user(普通用户), merchant(商家), admin(管理员), super_admin(超级管理员)';

-- 5. 更新现有数据
-- 将所有有商家记录的用户设置为 merchant 角色
UPDATE public.profiles
SET role = 'merchant'
WHERE is_merchant = TRUE
  AND role = 'user';

-- 6. 验证结果
SELECT
  'role 字段统计:' as info,
  role,
  COUNT(*) as user_count
FROM public.profiles
GROUP BY role
ORDER BY role;

-- 完成提示
SELECT '✅ role 字段已成功添加到 profiles 表' as status;
