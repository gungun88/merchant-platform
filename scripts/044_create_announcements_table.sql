-- 创建公告表
CREATE TABLE IF NOT EXISTS public.announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info' CHECK (type IN ('info', 'warning', 'success', 'error', 'update')),
  priority INTEGER NOT NULL DEFAULT 0 CHECK (priority >= 0 AND priority <= 10),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
  target_audience TEXT NOT NULL DEFAULT 'all' CHECK (target_audience IN ('all', 'users', 'merchants', 'partners')),
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  click_count INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_announcements_is_active ON public.announcements(is_active);
CREATE INDEX IF NOT EXISTS idx_announcements_is_pinned ON public.announcements(is_pinned);
CREATE INDEX IF NOT EXISTS idx_announcements_type ON public.announcements(type);
CREATE INDEX IF NOT EXISTS idx_announcements_target_audience ON public.announcements(target_audience);
CREATE INDEX IF NOT EXISTS idx_announcements_priority ON public.announcements(priority DESC);
CREATE INDEX IF NOT EXISTS idx_announcements_created_at ON public.announcements(created_at DESC);

-- 创建触发器以自动更新 updated_at
CREATE OR REPLACE FUNCTION update_announcements_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_announcements_updated_at ON public.announcements;
CREATE TRIGGER trigger_update_announcements_updated_at
  BEFORE UPDATE ON public.announcements
  FOR EACH ROW
  EXECUTE FUNCTION update_announcements_updated_at();

-- 启用 RLS
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- RLS 策略：所有人都可以查看激活的公告
CREATE POLICY "所有人可以查看激活的公告"
  ON public.announcements
  FOR SELECT
  USING (is_active = TRUE);

-- RLS 策略：管理员可以查看所有公告
CREATE POLICY "管理员可以查看所有公告"
  ON public.announcements
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- RLS 策略：管理员可以插入公告
CREATE POLICY "管理员可以插入公告"
  ON public.announcements
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- RLS 策略：管理员可以更新公告
CREATE POLICY "管理员可以更新公告"
  ON public.announcements
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- RLS 策略：管理员可以删除公告
CREATE POLICY "管理员可以删除公告"
  ON public.announcements
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- 启用实时订阅
ALTER PUBLICATION supabase_realtime ADD TABLE public.announcements;

-- 添加注释
COMMENT ON TABLE public.announcements IS '系统公告表';
COMMENT ON COLUMN public.announcements.title IS '公告标题';
COMMENT ON COLUMN public.announcements.content IS '公告内容';
COMMENT ON COLUMN public.announcements.type IS '公告类型：info-信息, warning-警告, success-成功, error-错误, update-更新';
COMMENT ON COLUMN public.announcements.priority IS '优先级：0-10，数字越大优先级越高';
COMMENT ON COLUMN public.announcements.is_active IS '是否激活';
COMMENT ON COLUMN public.announcements.is_pinned IS '是否置顶';
COMMENT ON COLUMN public.announcements.target_audience IS '目标受众：all-所有人, users-普通用户, merchants-商家, partners-合作伙伴';
COMMENT ON COLUMN public.announcements.start_date IS '开始显示时间';
COMMENT ON COLUMN public.announcements.end_date IS '结束显示时间';
COMMENT ON COLUMN public.announcements.click_count IS '点击次数';
COMMENT ON COLUMN public.announcements.created_by IS '创建者';
