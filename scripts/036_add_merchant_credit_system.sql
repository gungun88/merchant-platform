-- 商家信用积分系统
-- 添加信用分数字段和积分变动记录表

-- 1. 在 merchants 表添加 credit_score 字段
ALTER TABLE public.merchants
ADD COLUMN IF NOT EXISTS credit_score INTEGER DEFAULT 100 NOT NULL;

-- 添加约束：信用分数不能为负数
ALTER TABLE public.merchants
ADD CONSTRAINT credit_score_non_negative CHECK (credit_score >= 0);

-- 创建索引以提升查询性能
CREATE INDEX IF NOT EXISTS idx_merchants_credit_score ON public.merchants(credit_score DESC);

-- 2. 创建积分变动记录表
CREATE TABLE IF NOT EXISTS public.credit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  admin_id UUID NOT NULL REFERENCES auth.users(id),
  report_id UUID REFERENCES public.reports(id) ON DELETE SET NULL,
  change_amount INTEGER NOT NULL, -- 变动积分（负数为扣分）
  previous_score INTEGER NOT NULL, -- 变动前的分数
  new_score INTEGER NOT NULL, -- 变动后的分数
  reason TEXT NOT NULL, -- 变动原因
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_credit_logs_merchant_id ON public.credit_logs(merchant_id);
CREATE INDEX IF NOT EXISTS idx_credit_logs_created_at ON public.credit_logs(created_at DESC);

-- 3. 初始化现有商家的信用分数（如果之前没有设置）
UPDATE public.merchants
SET credit_score = 100
WHERE credit_score IS NULL;

-- 4. 创建触发器函数 - 当信用分数降到0时自动下架商家
CREATE OR REPLACE FUNCTION auto_deactivate_merchant_on_low_credit()
RETURNS TRIGGER AS $$
BEGIN
  -- 如果信用分数降到0或以下，自动下架商家
  IF NEW.credit_score <= 0 AND OLD.credit_score > 0 THEN
    NEW.is_active = FALSE;

    -- 发送通知给商家
    INSERT INTO public.user_notifications (user_id, type, title, content)
    VALUES (
      NEW.user_id,
      'merchant_deactivated',
      '商家已被自动下架',
      '由于信用分数降至0分，您的商家【' || NEW.name || '】已被系统自动下架。如有疑问请联系客服。'
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. 创建触发器
DROP TRIGGER IF EXISTS trigger_auto_deactivate_merchant ON public.merchants;
CREATE TRIGGER trigger_auto_deactivate_merchant
  BEFORE UPDATE OF credit_score ON public.merchants
  FOR EACH ROW
  WHEN (NEW.credit_score IS DISTINCT FROM OLD.credit_score)
  EXECUTE FUNCTION auto_deactivate_merchant_on_low_credit();

-- 6. 设置 RLS 策略

-- credit_logs 表 RLS
ALTER TABLE public.credit_logs ENABLE ROW LEVEL SECURITY;

-- 管理员可以查看所有记录
CREATE POLICY "管理员可以查看所有积分记录" ON public.credit_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- 管理员可以插入记录
CREATE POLICY "管理员可以创建积分记录" ON public.credit_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- 商家可以查看自己的积分记录
CREATE POLICY "商家可以查看自己的积分记录" ON public.credit_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.merchants m
      WHERE m.id = credit_logs.merchant_id AND m.user_id = auth.uid()
    )
  );

-- 所有人都可以看到商家的信用分数（通过 merchants 表）
-- merchants 表已有 RLS，不需要额外设置

-- 7. 验证结果
SELECT
  'credit_score 字段已添加' as status,
  COUNT(*) as merchant_count,
  AVG(credit_score) as avg_credit_score,
  MIN(credit_score) as min_credit_score,
  MAX(credit_score) as max_credit_score
FROM public.merchants;

SELECT
  'credit_logs 表已创建' as status,
  COUNT(*) as log_count
FROM public.credit_logs;

-- 8. 显示表结构
SELECT
  column_name,
  data_type,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'merchants'
  AND table_schema = 'public'
  AND column_name IN ('credit_score', 'is_active')
ORDER BY column_name;

SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'credit_logs'
  AND table_schema = 'public'
ORDER BY ordinal_position;
