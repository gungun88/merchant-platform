-- 为广告Banner表添加到期时间字段

-- 步骤1: 添加到期时间字段
ALTER TABLE public.banners ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE;

-- 步骤2: 添加注释
COMMENT ON COLUMN public.banners.expires_at IS '广告到期时间,到期后自动禁用';

-- 步骤3: 创建自动禁用过期广告的函数
CREATE OR REPLACE FUNCTION disable_expired_banners()
RETURNS void AS $$
BEGIN
  UPDATE public.banners
  SET is_active = false
  WHERE expires_at IS NOT NULL
    AND expires_at <= NOW()
    AND is_active = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 步骤4: 添加函数注释
COMMENT ON FUNCTION disable_expired_banners() IS '自动禁用已过期的广告Banner';
