-- ====================================================================
-- Supabase Storage 策略配置
-- 用途: 为 public 存储桶设置 RLS 策略,允许已认证用户上传合作伙伴 Logo
-- ====================================================================

-- 首先删除可能存在的旧策略(如果不存在会报错,但不影响后续执行)
DROP POLICY IF EXISTS "允许已认证用户上传合作伙伴 Logo" ON storage.objects;
DROP POLICY IF EXISTS "允许所有人查看 public 存储桶文件" ON storage.objects;
DROP POLICY IF EXISTS "允许用户更新自己上传的文件" ON storage.objects;
DROP POLICY IF EXISTS "允许管理员删除文件" ON storage.objects;

-- 2. 创建策略: 允许已认证用户上传到 partner-logos 文件夹
CREATE POLICY "允许已认证用户上传合作伙伴 Logo"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'public'
  AND (storage.foldername(name))[1] = 'partner-logos'
);

-- 3. 创建策略: 允许所有人查看 public 存储桶中的文件
CREATE POLICY "允许所有人查看 public 存储桶文件"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'public');

-- 4. 创建策略: 允许已认证用户更新自己上传的文件
CREATE POLICY "允许用户更新自己上传的文件"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'public'
  AND (storage.foldername(name))[1] = 'partner-logos'
  AND owner = auth.uid()
)
WITH CHECK (
  bucket_id = 'public'
  AND (storage.foldername(name))[1] = 'partner-logos'
  AND owner = auth.uid()
);

-- 5. 创建策略: 允许管理员删除任何文件
CREATE POLICY "允许管理员删除文件"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'public'
  AND (storage.foldername(name))[1] = 'partner-logos'
  AND (
    owner = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin')
    )
  )
);

-- 6. 显示当前策略
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
WHERE tablename = 'objects'
  AND schemaname = 'storage'
ORDER BY policyname;
