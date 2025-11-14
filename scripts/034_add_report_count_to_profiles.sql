-- 在 profiles 表添加举报次数统计字段
-- 用于记录用户累计举报次数

-- 1. 添加 report_count 字段
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS report_count INTEGER DEFAULT 0 NOT NULL;

-- 2. 创建索引以提升查询性能
CREATE INDEX IF NOT EXISTS idx_profiles_report_count ON public.profiles(report_count DESC);

-- 3. 初始化现有用户的举报次数
UPDATE public.profiles p
SET report_count = (
  SELECT COUNT(*)
  FROM public.reports r
  WHERE r.reporter_id = p.id
)
WHERE EXISTS (
  SELECT 1 FROM public.reports WHERE reporter_id = p.id
);

-- 4. 创建触发器函数 - 自动增加举报次数
CREATE OR REPLACE FUNCTION increment_user_report_count()
RETURNS TRIGGER AS $$
BEGIN
  -- 当新增举报时，增加举报者的举报次数
  UPDATE public.profiles
  SET report_count = report_count + 1
  WHERE id = NEW.reporter_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. 创建触发器 - 新增举报时自动执行
DROP TRIGGER IF EXISTS trigger_increment_report_count ON public.reports;
CREATE TRIGGER trigger_increment_report_count
  AFTER INSERT ON public.reports
  FOR EACH ROW
  EXECUTE FUNCTION increment_user_report_count();

-- 6. 创建触发器函数 - 删除举报时减少次数
CREATE OR REPLACE FUNCTION decrement_user_report_count()
RETURNS TRIGGER AS $$
BEGIN
  -- 当删除举报时，减少举报者的举报次数
  UPDATE public.profiles
  SET report_count = GREATEST(report_count - 1, 0)  -- 确保不会小于0
  WHERE id = OLD.reporter_id;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- 7. 创建触发器 - 删除举报时自动执行
DROP TRIGGER IF EXISTS trigger_decrement_report_count ON public.reports;
CREATE TRIGGER trigger_decrement_report_count
  AFTER DELETE ON public.reports
  FOR EACH ROW
  EXECUTE FUNCTION decrement_user_report_count();

-- 8. 验证结果
SELECT
  p.id,
  p.username,
  p.report_count,
  (SELECT COUNT(*) FROM public.reports WHERE reporter_id = p.id) as actual_count
FROM public.profiles p
WHERE p.report_count > 0
ORDER BY p.report_count DESC
LIMIT 10;

-- 9. 显示统计信息
SELECT
  COUNT(*) as total_users,
  COUNT(CASE WHEN report_count > 0 THEN 1 END) as users_with_reports,
  AVG(report_count) as avg_reports_per_user,
  MAX(report_count) as max_reports
FROM public.profiles;
