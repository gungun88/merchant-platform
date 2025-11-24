-- 创建Banner图片存储桶配置

-- 步骤1: 创建公开的banner存储桶
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'banners',
  'banners',
  true,  -- 公开访问
  5242880,  -- 5MB文件大小限制
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']  -- 允许的图片类型
)
ON CONFLICT (id) DO NOTHING;

-- 步骤2: 设置存储桶的RLS策略

-- 删除已存在的策略（如果有）
DROP POLICY IF EXISTS "Anyone can view banner images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload banner images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update banner images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete banner images" ON storage.objects;

-- 任何人都可以查看banner图片
CREATE POLICY "Anyone can view banner images"
ON storage.objects FOR SELECT
USING (bucket_id = 'banners');

-- 只有管理员可以上传banner图片
CREATE POLICY "Admins can upload banner images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'banners' AND
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('admin', 'super_admin')
  )
);

-- 只有管理员可以更新banner图片
CREATE POLICY "Admins can update banner images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'banners' AND
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('admin', 'super_admin')
  )
);

-- 只有管理员可以删除banner图片
CREATE POLICY "Admins can delete banner images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'banners' AND
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('admin', 'super_admin')
  )
);
