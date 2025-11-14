/**
 * 设置用户为管理员
 *
 * 使用方法:
 * 1. 在 Supabase 项目中找到用户的 user_id
 * 2. 修改下面的 'YOUR_USER_ID_HERE' 为实际的用户ID
 * 3. 在 Supabase SQL Editor 中执行此脚本
 */

-- 方式一: 直接在 SQL Editor 中执行
-- 将下面的 'YOUR_USER_ID_HERE' 替换为实际的用户ID

UPDATE public.profiles
SET role = 'admin'
WHERE id = 'YOUR_USER_ID_HERE';

-- 验证是否设置成功
SELECT
  p.id,
  p.username,
  au.email,
  p.role,
  p.is_merchant,
  p.points,
  p.created_at
FROM public.profiles p
LEFT JOIN auth.users au ON p.id = au.id
WHERE p.id = 'YOUR_USER_ID_HERE';


-- 方式二: 通过邮箱设置管理员 (推荐使用这个方式)
-- 将下面的 'admin@example.com' 替换为实际的管理员邮箱

UPDATE public.profiles
SET role = 'admin'
WHERE id IN (
  SELECT id FROM auth.users WHERE email = 'admin@example.com'
);

-- 验证是否设置成功
SELECT
  p.id,
  p.username,
  au.email,
  p.role,
  p.is_merchant,
  p.points,
  p.created_at
FROM public.profiles p
LEFT JOIN auth.users au ON p.id = au.id
WHERE au.email = 'admin@example.com';


-- 查询所有管理员
SELECT
  p.id,
  p.username,
  au.email,
  p.role,
  p.created_at
FROM public.profiles p
LEFT JOIN auth.users au ON p.id = au.id
WHERE p.role IN ('admin', 'super_admin')
ORDER BY p.created_at DESC;
