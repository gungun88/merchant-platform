-- 创建广告Banner表
CREATE TABLE IF NOT EXISTS public.banners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  position VARCHAR(20) NOT NULL,
  image_url TEXT NOT NULL,
  link_url TEXT,
  title VARCHAR(100),
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 删除旧的约束（如果存在）
ALTER TABLE public.banners DROP CONSTRAINT IF EXISTS banners_position_check;

-- 添加新的约束
ALTER TABLE public.banners ADD CONSTRAINT banners_position_check
  CHECK (position IN ('left', 'middle_top', 'middle_bottom', 'right', 'right_top', 'right_bottom'));

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_banners_position ON public.banners(position);
CREATE INDEX IF NOT EXISTS idx_banners_is_active ON public.banners(is_active);
CREATE INDEX IF NOT EXISTS idx_banners_sort_order ON public.banners(sort_order);

-- 添加注释
COMMENT ON TABLE public.banners IS '广告Banner表';
COMMENT ON COLUMN public.banners.position IS 'Banner位置: left(左侧轮播), middle_top(中间上方), middle_bottom(中间下方), right(右侧-兼容旧版), right_top(右侧上方), right_bottom(右侧下方)';
COMMENT ON COLUMN public.banners.image_url IS '图片URL';
COMMENT ON COLUMN public.banners.link_url IS '点击跳转链接(可选)';
COMMENT ON COLUMN public.banners.title IS '标题(可选)';
COMMENT ON COLUMN public.banners.description IS '描述(可选)';
COMMENT ON COLUMN public.banners.sort_order IS '排序顺序(数字越小越靠前)';
COMMENT ON COLUMN public.banners.is_active IS '是否激活显示';

-- 创建更新时间触发器
CREATE OR REPLACE FUNCTION update_banners_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_banners_updated_at ON public.banners;

CREATE TRIGGER trigger_update_banners_updated_at
  BEFORE UPDATE ON public.banners
  FOR EACH ROW
  EXECUTE FUNCTION update_banners_updated_at();

-- 设置RLS策略
ALTER TABLE public.banners ENABLE ROW LEVEL SECURITY;

-- 删除已存在的策略（如果有）
DROP POLICY IF EXISTS "Anyone can view active banners" ON public.banners;
DROP POLICY IF EXISTS "Admins can view all banners" ON public.banners;
DROP POLICY IF EXISTS "Admins can insert banners" ON public.banners;
DROP POLICY IF EXISTS "Admins can update banners" ON public.banners;
DROP POLICY IF EXISTS "Admins can delete banners" ON public.banners;

-- 所有用户可以查看激活的banner
CREATE POLICY "Anyone can view active banners"
  ON public.banners
  FOR SELECT
  USING (is_active = true);

-- 管理员可以查看所有banner
CREATE POLICY "Admins can view all banners"
  ON public.banners
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- 管理员可以插入banner
CREATE POLICY "Admins can insert banners"
  ON public.banners
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- 管理员可以更新banner
CREATE POLICY "Admins can update banners"
  ON public.banners
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- 管理员可以删除banner
CREATE POLICY "Admins can delete banners"
  ON public.banners
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- 插入默认占位符数据 (使用unsplash图片)
INSERT INTO public.banners (position, image_url, title, description, sort_order, is_active) VALUES
  ('left', 'https://images.unsplash.com/photo-1557821552-17105176677c?w=520&h=180&fit=crop', '优质商家推荐', '精选优质商家，品质保证', 1, true),
  ('left', 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=520&h=180&fit=crop', '新商家入驻', '欢迎更多商家加入我们', 2, true),
  ('left', 'https://images.unsplash.com/photo-1563013544-824ae1b704d3?w=520&h=180&fit=crop', '热门服务', '发现更多热门服务', 3, true),
  ('middle_top', 'https://images.unsplash.com/photo-1559056199-641a0ac8b55e?w=172&h=84&fit=crop', '会员特权', '升级会员享更多优惠', 1, true),
  ('middle_bottom', 'https://images.unsplash.com/photo-1516321497487-e288fb19713f?w=172&h=84&fit=crop', '积分商城', '积分兑换好礼', 1, true),
  ('right_top', 'https://images.unsplash.com/photo-1512428559087-560fa5ceab42?w=260&h=84&fit=crop', '限时优惠', '限时优惠活动进行中', 1, true),
  ('right_bottom', 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=260&h=84&fit=crop', '新品上线', '全新服务等你体验', 1, true);
