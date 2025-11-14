-- 添加认证状态字段
ALTER TABLE public.merchants 
ADD COLUMN IF NOT EXISTS certification_status text DEFAULT '待认证';

-- 更新已有数据的库存状态（将英文改为中文）
UPDATE public.merchants 
SET stock_status = '充足' 
WHERE stock_status = 'sufficient';

-- 添加认证状态的检查约束
ALTER TABLE public.merchants
ADD CONSTRAINT check_certification_status 
CHECK (certification_status IN ('待认证', '已认证', '认证失败'));
