-- 更新 reports 表结构
-- 从旧版本迁移到新版本（添加 evidence_urls 字段和重命名字段）

-- 1. 添加新字段
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS evidence_urls TEXT[];
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS report_type VARCHAR(50);
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS report_reason TEXT;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS admin_id UUID REFERENCES auth.users(id);
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS admin_note TEXT;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ;

-- 2. 迁移旧数据到新字段
UPDATE public.reports
SET report_type = reason
WHERE report_type IS NULL AND reason IS NOT NULL;

UPDATE public.reports
SET report_reason = details
WHERE report_reason IS NULL AND details IS NOT NULL;

-- 3. 删除旧字段（如果确认数据已迁移）
-- 注意：请先备份数据，确认迁移成功后再执行删除操作
-- ALTER TABLE public.reports DROP COLUMN IF EXISTS reason;
-- ALTER TABLE public.reports DROP COLUMN IF EXISTS details;
-- ALTER TABLE public.reports DROP COLUMN IF EXISTS admin_notes;

-- 4. 设置新字段为 NOT NULL（在确保所有数据已迁移后）
-- ALTER TABLE public.reports ALTER COLUMN report_type SET NOT NULL;
-- ALTER TABLE public.reports ALTER COLUMN report_reason SET NOT NULL;

-- 5. 创建或更新索引
CREATE INDEX IF NOT EXISTS idx_reports_reporter_id ON public.reports(reporter_id);
CREATE INDEX IF NOT EXISTS idx_reports_merchant_id ON public.reports(merchant_id);
CREATE INDEX IF NOT EXISTS idx_reports_status ON public.reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON public.reports(created_at DESC);

-- 6. 更新触发器（如果不存在）
CREATE OR REPLACE FUNCTION update_reports_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_reports_updated_at ON public.reports;
CREATE TRIGGER trigger_reports_updated_at
  BEFORE UPDATE ON public.reports
  FOR EACH ROW
  EXECUTE FUNCTION update_reports_updated_at();

-- 7. 验证表结构
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'reports' AND table_schema = 'public'
ORDER BY ordinal_position;
