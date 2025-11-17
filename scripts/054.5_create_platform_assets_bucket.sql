-- 创建平台资源存储桶
-- 在 Supabase Storage 中创建用于存储平台资源（如 logo）的存储桶

-- 注意：此脚本需要在 Supabase Dashboard 的 SQL Editor 中执行
-- 或者你可以直接在 Supabase Dashboard > Storage 界面手动创建

-- 插入存储桶配置
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'platform-assets',
  'platform-assets',
  true, -- 公开访问
  2097152, -- 2MB 文件大小限制
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']::text[]
)
ON CONFLICT (id) DO NOTHING;

-- 创建存储策略：允许所有人读取
CREATE POLICY "公开读取平台资源"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'platform-assets');

-- 创建存储策略：只有管理员可以上传
CREATE POLICY "管理员可以上传平台资源"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'platform-assets'
  AND EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND (profiles.role = 'admin' OR profiles.role = 'super_admin')
  )
);

-- 创建存储策略：只有管理员可以更新
CREATE POLICY "管理员可以更新平台资源"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'platform-assets'
  AND EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND (profiles.role = 'admin' OR profiles.role = 'super_admin')
  )
);

-- 创建存储策略：只有管理员可以删除
CREATE POLICY "管理员可以删除平台资源"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'platform-assets'
  AND EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND (profiles.role = 'admin' OR profiles.role = 'super_admin')
  )
);

COMMENT ON TABLE storage.buckets IS '存储桶: platform-assets 用于存储平台资源文件（如 logo、banner 等）';
