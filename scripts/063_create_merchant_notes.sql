-- 创建商家备注表
CREATE TABLE IF NOT EXISTS merchant_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  note TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, merchant_id)
);

-- 添加索引
CREATE INDEX IF NOT EXISTS idx_merchant_notes_user_id ON merchant_notes(user_id);
CREATE INDEX IF NOT EXISTS idx_merchant_notes_merchant_id ON merchant_notes(merchant_id);

-- 添加注释
COMMENT ON TABLE merchant_notes IS '用户对商家的备注';
COMMENT ON COLUMN merchant_notes.user_id IS '用户ID';
COMMENT ON COLUMN merchant_notes.merchant_id IS '商家ID';
COMMENT ON COLUMN merchant_notes.note IS '备注内容';

-- RLS 策略
ALTER TABLE merchant_notes ENABLE ROW LEVEL SECURITY;

-- 用户只能查看自己的备注
CREATE POLICY "用户可以查看自己的备注"
  ON merchant_notes
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- 用户可以创建自己的备注
CREATE POLICY "用户可以创建备注"
  ON merchant_notes
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 用户可以更新自己的备注
CREATE POLICY "用户可以更新自己的备注"
  ON merchant_notes
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 用户可以删除自己的备注
CREATE POLICY "用户可以删除自己的备注"
  ON merchant_notes
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
