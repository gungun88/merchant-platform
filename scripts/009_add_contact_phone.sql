-- 添加电话联系方式字段
ALTER TABLE public.merchants 
ADD COLUMN IF NOT EXISTS contact_phone text;

-- 添加注释
COMMENT ON COLUMN public.merchants.contact_phone IS '电话联系方式';
