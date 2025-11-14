-- 修复库存状态，将英文改为中文
UPDATE public.merchants 
SET stock_status = CASE 
  WHEN stock_status = 'sufficient' THEN '现货充足'
  WHEN stock_status = 'in_stock' THEN '现货充足'
  WHEN stock_status = 'low_stock' THEN '库存紧张'
  WHEN stock_status = 'pre_order' THEN '需预订'
  ELSE stock_status
END
WHERE stock_status IN ('sufficient', 'in_stock', 'low_stock', 'pre_order');

-- 添加注释
COMMENT ON COLUMN public.merchants.stock_status IS '库存状态：现货充足、库存紧张、需预订、500+现货、1000+现货';
