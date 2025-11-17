-- 修复 Storage 的 RLS 策略
-- 删除现有的策略并重新创建

-- 1. 删除可能存在的旧策略
DROP POLICY IF EXISTS "公开读取平台资源" ON storage.objects;
DROP POLICY IF EXISTS "管理员可以上传平台资源" ON storage.objects;
DROP POLICY IF EXISTS "管理员可以更新平台资源" ON storage.objects;
DROP POLICY IF EXISTS "管理员可以删除平台资源" ON storage.objects;

-- 2. 创建新的策略

-- 允许所有人读取 platform-assets 中的文件
CREATE POLICY "Anyone can view platform assets"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'platform-assets');

-- 允许认证用户上传到 platform-assets
CREATE POLICY "Authenticated users can upload platform assets"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'platform-assets');

-- 允许认证用户更新 platform-assets 中的文件
CREATE POLICY "Authenticated users can update platform assets"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'platform-assets');

-- 允许认证用户删除 platform-assets 中的文件
CREATE POLICY "Authenticated users can delete platform assets"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'platform-assets');
