-- 使用 service_role 权限直接查询,绕过 RLS
-- 注意:这个查询需要在 Supabase SQL Editor 中以 postgres 角色运行

-- 1. 检查成员表的实际数据(绕过 RLS)
SELECT
  m.id,
  m.group_id,
  m.user_id,
  m.added_by,
  m.added_at,
  p.email,
  p.username
FROM public.user_group_members m
LEFT JOIN public.profiles p ON p.id = m.user_id
WHERE m.group_id = '1ad7c993-0dbd-4e35-881d-6ad2aad7f092'
ORDER BY m.added_at DESC;

-- 2. 检查所有成员(不限定 group_id)
SELECT COUNT(*) as total_members FROM public.user_group_members;

-- 3. 检查 user_group_members 表的 RLS 策略
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'user_group_members';

-- 4. 检查当前用户的角色
SELECT
  auth.uid() as current_user_id,
  p.role as current_user_role,
  p.email
FROM public.profiles p
WHERE p.id = auth.uid();
