-- 创建举报表
-- 用于记录用户对商家的举报信息

-- 1. 创建举报表
CREATE TABLE IF NOT EXISTS public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 举报相关信息
  reporter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,

  -- 举报内容
  report_type VARCHAR(50) NOT NULL, -- 举报类型: '欺诈', '虚假宣传', '服务态度差', '质量问题', '其他'
  report_reason TEXT NOT NULL, -- 举报原因详细描述
  evidence_urls TEXT[], -- 证据图片URL数组

  -- 审核相关
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 状态: 'pending'(待处理), 'approved'(已通过), 'rejected'(已驳回)
  admin_id UUID REFERENCES auth.users(id), -- 处理的管理员ID
  admin_note TEXT, -- 管理员处理备注
  processed_at TIMESTAMPTZ, -- 处理时间

  -- 时间戳
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. 创建索引
CREATE INDEX IF NOT EXISTS idx_reports_reporter_id ON public.reports(reporter_id);
CREATE INDEX IF NOT EXISTS idx_reports_merchant_id ON public.reports(merchant_id);
CREATE INDEX IF NOT EXISTS idx_reports_status ON public.reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON public.reports(created_at DESC);

-- 3. 启用RLS
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- 4. 创建RLS策略
-- 用户可以查看自己提交的举报
CREATE POLICY "用户可以查看自己的举报"
  ON public.reports
  FOR SELECT
  USING (
    auth.uid() = reporter_id
  );

-- 用户可以创建举报
CREATE POLICY "用户可以创建举报"
  ON public.reports
  FOR INSERT
  WITH CHECK (
    auth.uid() = reporter_id
  );

-- 管理员可以查看所有举报
CREATE POLICY "管理员可以查看所有举报"
  ON public.reports
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- 管理员可以更新举报状态
CREATE POLICY "管理员可以更新举报"
  ON public.reports
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- 5. 创建更新时间触发器
CREATE OR REPLACE FUNCTION update_reports_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_reports_updated_at
  BEFORE UPDATE ON public.reports
  FOR EACH ROW
  EXECUTE FUNCTION update_reports_updated_at();

-- 6. 验证表结构
SELECT
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'reports'
ORDER BY ordinal_position;

-- 7. 显示创建的索引
SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'reports';
