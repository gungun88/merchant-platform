-- 添加交易哈希字段到押金商家申请表
-- 用于记录用户支付押金时的区块链交易哈希/交易ID

ALTER TABLE public.deposit_merchant_applications
ADD COLUMN IF NOT EXISTS transaction_hash TEXT;

COMMENT ON COLUMN public.deposit_merchant_applications.transaction_hash IS '交易哈希/交易ID（区块链交易凭证）';
