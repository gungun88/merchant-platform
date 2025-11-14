-- 创建合作伙伴表
CREATE TABLE IF NOT EXISTS partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  logo_url TEXT,
  website_url TEXT NOT NULL,
  description TEXT,
  status VARCHAR(50) DEFAULT 'pending',
  -- 状态: pending(待审核), approved(已审核), rejected(已拒绝)
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  approved_at TIMESTAMP WITH TIME ZONE,
  approved_by UUID REFERENCES auth.users(id),
  rejection_reason TEXT,
  sort_order INTEGER DEFAULT 0
  -- 排序顺序,数字越小越靠前
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_partners_status ON partners (status);

CREATE INDEX IF NOT EXISTS idx_partners_created_at ON partners (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_partners_sort_order ON partners (sort_order ASC, created_at DESC);

-- 启用 RLS
ALTER TABLE partners ENABLE ROW LEVEL SECURITY;

-- RLS 策略:所有人可以查看已审核的合作伙伴
CREATE POLICY "Anyone can view approved partners" ON partners FOR
SELECT
  USING (status = 'approved');

-- RLS 策略:认证用户可以创建合作伙伴申请
CREATE POLICY "Authenticated users can create partner applications" ON partners FOR INSERT TO authenticated
WITH
  CHECK (auth.uid () = created_by);

-- RLS 策略:申请人可以查看自己的申请
CREATE POLICY "Users can view their own partner applications" ON partners FOR
SELECT
  TO authenticated USING (auth.uid () = created_by);

-- RLS 策略:管理员可以查看所有合作伙伴
CREATE POLICY "Admins can view all partners" ON partners FOR
SELECT
  TO authenticated USING (
    EXISTS (
      SELECT
        1
      FROM
        profiles
      WHERE
        profiles.id = auth.uid ()
        AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- RLS 策略:管理员可以更新合作伙伴状态
CREATE POLICY "Admins can update partners" ON partners FOR
UPDATE TO authenticated USING (
  EXISTS (
    SELECT
      1
    FROM
      profiles
    WHERE
      profiles.id = auth.uid ()
      AND profiles.role IN ('admin', 'super_admin')
  )
)
WITH
  CHECK (
    EXISTS (
      SELECT
        1
      FROM
        profiles
      WHERE
        profiles.id = auth.uid ()
        AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- 创建更新时间戳的触发器函数(如果不存在)
CREATE OR REPLACE FUNCTION update_updated_at_column () RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 为 partners 表添加触发器
DROP TRIGGER IF EXISTS update_partners_updated_at ON partners;

CREATE TRIGGER update_partners_updated_at BEFORE
UPDATE ON partners FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column ();

-- 添加注释
COMMENT ON TABLE partners IS '合作伙伴表';

COMMENT ON COLUMN partners.id IS '主键ID';

COMMENT ON COLUMN partners.name IS '合作伙伴名称';

COMMENT ON COLUMN partners.logo_url IS 'Logo图片URL';

COMMENT ON COLUMN partners.website_url IS '官网链接';

COMMENT ON COLUMN partners.description IS '合作伙伴描述';

COMMENT ON COLUMN partners.status IS '状态: pending(待审核), approved(已审核), rejected(已拒绝)';

COMMENT ON COLUMN partners.created_by IS '申请人用户ID';

COMMENT ON COLUMN partners.approved_by IS '审核人用户ID';

COMMENT ON COLUMN partners.rejection_reason IS '拒绝原因';

COMMENT ON COLUMN partners.sort_order IS '排序顺序';
