-- 添加商家上架状态字段
ALTER TABLE merchants
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

COMMENT ON COLUMN merchants.is_active IS '商家是否上架（true=上架，false=下架）';

-- 创建举报表
CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  reporter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  details TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewing', 'resolved', 'rejected')),
  admin_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE reports IS '商家举报记录表';
COMMENT ON COLUMN reports.merchant_id IS '被举报的商家ID';
COMMENT ON COLUMN reports.reporter_id IS '举报人ID';
COMMENT ON COLUMN reports.reason IS '举报原因类型';
COMMENT ON COLUMN reports.details IS '举报详细说明';
COMMENT ON COLUMN reports.status IS '处理状态：pending=待处理，reviewing=审核中，resolved=已处理，rejected=已驳回';
COMMENT ON COLUMN reports.admin_notes IS '管理员备注';

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_reports_merchant_id ON reports(merchant_id);
CREATE INDEX IF NOT EXISTS idx_reports_reporter_id ON reports(reporter_id);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON reports(created_at DESC);

-- 添加更新时间触发器
CREATE OR REPLACE FUNCTION update_reports_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_reports_updated_at
  BEFORE UPDATE ON reports
  FOR EACH ROW
  EXECUTE FUNCTION update_reports_updated_at();

-- 设置RLS策略
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- 用户可以创建举报
CREATE POLICY "Users can create reports"
  ON reports FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = reporter_id);

-- 用户可以查看自己提交的举报
CREATE POLICY "Users can view their own reports"
  ON reports FOR SELECT
  TO authenticated
  USING (auth.uid() = reporter_id);

-- 商家可以查看针对自己的举报
CREATE POLICY "Merchants can view reports about them"
  ON reports FOR SELECT
  TO authenticated
  USING (
    merchant_id IN (
      SELECT id FROM merchants WHERE user_id = auth.uid()
    )
  );
