-- 简化广告Banner表结构为3个位置 (left/middle/right)

-- 步骤1: 先清空旧数据(避免约束冲突)
TRUNCATE TABLE public.banners;

-- 步骤2: 删除旧的约束
ALTER TABLE public.banners DROP CONSTRAINT IF EXISTS banners_position_check;

-- 步骤3: 添加新的简化约束
ALTER TABLE public.banners ADD CONSTRAINT banners_position_check
  CHECK (position IN ('left', 'middle', 'right'));

-- 步骤4: 更新注释
COMMENT ON COLUMN public.banners.position IS 'Banner位置: left(左侧轮播), middle(中间栏-上下2格), right(右侧单栏)';

-- 插入新的简化占位符数据
INSERT INTO public.banners (position, image_url, title, description, sort_order, is_active) VALUES
  -- 左侧轮播 (3张)
  ('left', 'https://images.unsplash.com/photo-1557821552-17105176677c?w=800&h=400&fit=crop', '优质商家推荐', '精选优质商家，品质保证', 1, true),
  ('left', 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=800&h=400&fit=crop', '新商家入驻', '欢迎更多商家加入我们', 2, true),
  ('left', 'https://images.unsplash.com/photo-1563013544-824ae1b704d3?w=800&h=400&fit=crop', '热门服务', '发现更多热门服务', 3, true),
  -- 中间栏 (上下2格)
  ('middle', 'https://images.unsplash.com/photo-1559056199-641a0ac8b55e?w=400&h=180&fit=crop', '会员特权', '升级会员享更多优惠', 1, true),
  ('middle', 'https://images.unsplash.com/photo-1516321497487-e288fb19713f?w=400&h=180&fit=crop', '积分商城', '积分兑换好礼', 2, true),
  -- 右侧单栏 (1个大图)
  ('right', 'https://images.unsplash.com/photo-1512428559087-560fa5ceab42?w=600&h=400&fit=crop', '限时优惠', '限时优惠活动进行中', 1, true);
