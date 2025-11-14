-- 修复版本：添加商家上架状态字段和举报表
-- 此版本跳过已存在的对象，避免重复创建错误

-- 1. 添加商家上架状态字段（如果不存在）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'merchants' AND column_name = 'is_active'
  ) THEN
    ALTER TABLE merchants ADD COLUMN is_active BOOLEAN DEFAULT true;
    COMMENT ON COLUMN merchants.is_active IS '商家是否上架（true=上架，false=下架）';
  END IF;
END $$;

-- 2. 创建举报表（如果不存在）
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

-- 添加表注释
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'reports') THEN
    COMMENT ON TABLE reports IS '商家举报记录表';
    COMMENT ON COLUMN reports.merchant_id IS '被举报的商家ID';
    COMMENT ON COLUMN reports.reporter_id IS '举报人ID';
    COMMENT ON COLUMN reports.reason IS '举报原因类型';
    COMMENT ON COLUMN reports.details IS '举报详细说明';
    COMMENT ON COLUMN reports.status IS '处理状态：pending=待处理，reviewing=审核中，resolved=已处理，rejected=已驳回';
    COMMENT ON COLUMN reports.admin_notes IS '管理员备注';
  END IF;
END $$;

-- 3. 创建索引（如果不存在）
CREATE INDEX IF NOT EXISTS idx_reports_merchant_id ON reports(merchant_id);
CREATE INDEX IF NOT EXISTS idx_reports_reporter_id ON reports(reporter_id);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON reports(created_at DESC);

-- 4. 创建更新时间触发器函数（如果不存在）
CREATE OR REPLACE FUNCTION update_reports_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. 创建触发器（先删除旧的，再创建新的）
DROP TRIGGER IF EXISTS trigger_update_reports_updated_at ON reports;
CREATE TRIGGER trigger_update_reports_updated_at
  BEFORE UPDATE ON reports
  FOR EACH ROW
  EXECUTE FUNCTION update_reports_updated_at();

-- 6. 启用RLS（如果尚未启用）
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- 7. 删除旧策略（如果存在）并重新创建
DROP POLICY IF EXISTS "Users can create reports" ON reports;
DROP POLICY IF EXISTS "Users can view their own reports" ON reports;
DROP POLICY IF EXISTS "Merchants can view reports about them" ON reports;

-- 8. 创建新的RLS策略
CREATE POLICY "Users can create reports"
  ON reports FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "Users can view their own reports"
  ON reports FOR SELECT
  TO authenticated
  USING (auth.uid() = reporter_id);

CREATE POLICY "Merchants can view reports about them"
  ON reports FOR SELECT
  TO authenticated
  USING (
    merchant_id IN (
      SELECT id FROM merchants WHERE user_id = auth.uid()
    )
  );

-- 9. 验证结果
DO $$
BEGIN
  RAISE NOTICE '✓ 数据库迁移完成！';
  RAISE NOTICE '✓ merchants.is_active 字段已添加';
  RAISE NOTICE '✓ reports 表已创建';
  RAISE NOTICE '✓ 索引和触发器已设置';
  RAISE NOTICE '✓ RLS策略已配置';
END $$;
