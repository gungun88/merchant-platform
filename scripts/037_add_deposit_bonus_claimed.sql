-- 添加押金商家一次性奖励领取状态字段
-- 用于记录押金商家是否已领取审核通过后的1000积分奖励

ALTER TABLE public.merchants
ADD COLUMN IF NOT EXISTS deposit_bonus_claimed BOOLEAN DEFAULT false;

COMMENT ON COLUMN public.merchants.deposit_bonus_claimed IS '是否已领取押金商家审核通过奖励（1000积分一次性奖励）';

-- 为现有的押金商家设置为未领取状态
UPDATE public.merchants
SET deposit_bonus_claimed = false
WHERE is_deposit_merchant = true AND deposit_bonus_claimed IS NULL;
