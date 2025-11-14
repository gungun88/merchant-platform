-- 创建积分交易记录表
CREATE TABLE IF NOT EXISTS public.point_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL, -- 积分变动数量,正数为收入,负数为支出
  balance_after INTEGER NOT NULL, -- 交易后的余额
  type TEXT NOT NULL, -- 交易类型
  description TEXT NOT NULL, -- 详细描述
  related_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- 相关用户ID(邀请人等)
  related_merchant_id UUID REFERENCES public.merchants(id) ON DELETE SET NULL, -- 相关商家ID
  metadata JSONB, -- 额外信息
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 创建索引以优化查询性能
CREATE INDEX IF NOT EXISTS idx_point_transactions_user_id ON public.point_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_point_transactions_created_at ON public.point_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_point_transactions_type ON public.point_transactions(type);
CREATE INDEX IF NOT EXISTS idx_point_transactions_user_created ON public.point_transactions(user_id, created_at DESC);

-- 启用RLS
ALTER TABLE public.point_transactions ENABLE ROW LEVEL SECURITY;

-- RLS策略:用户只能查看自己的积分记录
CREATE POLICY "Users can view their own point transactions"
  ON public.point_transactions
  FOR SELECT
  USING (auth.uid() = user_id);

-- 插入策略:只允许通过服务器端函数插入(后续会创建)
CREATE POLICY "Service role can insert point transactions"
  ON public.point_transactions
  FOR INSERT
  WITH CHECK (true);

-- 启用Realtime(可选,如果需要实时更新积分记录)
ALTER PUBLICATION supabase_realtime ADD TABLE public.point_transactions;

-- 创建辅助函数:记录积分变动
CREATE OR REPLACE FUNCTION public.record_point_transaction(
  p_user_id UUID,
  p_amount INTEGER,
  p_type TEXT,
  p_description TEXT,
  p_related_user_id UUID DEFAULT NULL,
  p_related_merchant_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_points INTEGER;
  v_transaction_id UUID;
BEGIN
  -- 获取当前积分
  SELECT points INTO v_current_points
  FROM public.profiles
  WHERE id = p_user_id;

  IF v_current_points IS NULL THEN
    RAISE EXCEPTION 'User profile not found';
  END IF;

  -- 插入交易记录
  INSERT INTO public.point_transactions (
    user_id,
    amount,
    balance_after,
    type,
    description,
    related_user_id,
    related_merchant_id,
    metadata
  ) VALUES (
    p_user_id,
    p_amount,
    v_current_points + p_amount, -- 计算交易后余额
    p_type,
    p_description,
    p_related_user_id,
    p_related_merchant_id,
    p_metadata
  )
  RETURNING id INTO v_transaction_id;

  RETURN v_transaction_id;
END;
$$;

COMMENT ON TABLE public.point_transactions IS '积分交易记录表';
COMMENT ON COLUMN public.point_transactions.amount IS '积分变动数量,正数为收入,负数为支出';
COMMENT ON COLUMN public.point_transactions.balance_after IS '交易后的积分余额';
COMMENT ON COLUMN public.point_transactions.type IS '交易类型: registration, checkin, merchant_cert, invitation, view_contact, topped_promotion, system_adjustment';
COMMENT ON FUNCTION public.record_point_transaction IS '记录积分变动的辅助函数';
