-- =============================================
-- 添加用户角色字段
-- 执行日期: 2025-11-18
-- 说明: 为 profiles 表添加 role 字段，用于区分普通用户和管理员
-- =============================================

-- 1. 添加 role 字段
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'user' NOT NULL;

-- 2. 添加检查约束
ALTER TABLE public.profiles
DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
ADD CONSTRAINT profiles_role_check
CHECK (role IN ('user', 'merchant', 'admin', 'super_admin'));

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
  role,
  COUNT(*) as user_count
FROM public.profiles
GROUP BY role
ORDER BY role;

-- 7. 通知 PostgREST 重新加载架构
NOTIFY pgrst, 'reload schema';

-- 完成提示
DO $$
BEGIN
  RAISE NOTICE '✅ role 字段已成功添加到 profiles 表';
  RAISE NOTICE '✅ 默认角色为 user';
  RAISE NOTICE '✅ 商家用户已更新为 merchant 角色';
END $$;
