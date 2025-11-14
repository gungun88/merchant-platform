-- 创建通知表
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- 通知类型和分类
  type VARCHAR(50) NOT NULL, -- 'system', 'merchant', 'social', 'transaction'
  category VARCHAR(50) NOT NULL, -- 'checkin', 'favorite', 'merchant_update', 'contact_view', etc.

  -- 通知内容
  title VARCHAR(200) NOT NULL,
  content TEXT,

  -- 相关数据
  related_merchant_id UUID REFERENCES merchants(id) ON DELETE SET NULL,
  related_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  metadata JSONB, -- 存储额外数据（链接、参数等）

  -- 通知状态
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMP WITH TIME ZONE,

  -- 优先级
  priority VARCHAR(20) DEFAULT 'normal', -- 'high', 'normal', 'low'

  -- 时间戳
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE -- 过期时间（可选）
);

-- 创建索引优化查询性能
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, is_read) WHERE is_read = FALSE;

-- 添加表注释
COMMENT ON TABLE notifications IS '用户通知表';
COMMENT ON COLUMN notifications.type IS '通知类型: system-系统, merchant-商家, social-社交, transaction-交易';
COMMENT ON COLUMN notifications.category IS '通知分类: checkin-签到, favorite-收藏, merchant_update-商家更新, contact_view-查看联系方式等';
COMMENT ON COLUMN notifications.priority IS '优先级: high-高, normal-普通, low-低';

-- 启用 RLS (Row Level Security)
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- 创建 RLS 策略：用户只能查看自己的通知
CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  USING (auth.uid() = user_id);

-- 创建 RLS 策略：用户只能更新自己的通知（标记已读等）
CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  USING (auth.uid() = user_id);

-- 创建 RLS 策略：系统可以为任何用户创建通知
CREATE POLICY "System can insert notifications"
  ON notifications FOR INSERT
  WITH CHECK (true);

-- 创建 RLS 策略：用户可以删除自己的通知
CREATE POLICY "Users can delete own notifications"
  ON notifications FOR DELETE
  USING (auth.uid() = user_id);

-- 创建函数：获取用户未读通知数量
CREATE OR REPLACE FUNCTION get_unread_notification_count(p_user_id UUID)
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)::INTEGER
    FROM notifications
    WHERE user_id = p_user_id
      AND is_read = FALSE
      AND (expires_at IS NULL OR expires_at > NOW())
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 创建函数：批量标记通知为已读
CREATE OR REPLACE FUNCTION mark_notifications_as_read(p_user_id UUID, p_notification_ids UUID[])
RETURNS VOID AS $$
BEGIN
  UPDATE notifications
  SET is_read = TRUE,
      read_at = NOW()
  WHERE user_id = p_user_id
    AND id = ANY(p_notification_ids)
    AND is_read = FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 创建函数：标记所有通知为已读
CREATE OR REPLACE FUNCTION mark_all_notifications_as_read(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE notifications
  SET is_read = TRUE,
      read_at = NOW()
  WHERE user_id = p_user_id
    AND is_read = FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 创建函数：创建通知的辅助函数
CREATE OR REPLACE FUNCTION create_notification(
  p_user_id UUID,
  p_type VARCHAR(50),
  p_category VARCHAR(50),
  p_title VARCHAR(200),
  p_content TEXT DEFAULT NULL,
  p_related_merchant_id UUID DEFAULT NULL,
  p_related_user_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL,
  p_priority VARCHAR(20) DEFAULT 'normal',
  p_expires_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  notification_id UUID;
BEGIN
  INSERT INTO notifications (
    user_id, type, category, title, content,
    related_merchant_id, related_user_id, metadata,
    priority, expires_at
  )
  VALUES (
    p_user_id, p_type, p_category, p_title, p_content,
    p_related_merchant_id, p_related_user_id, p_metadata,
    p_priority, p_expires_at
  )
  RETURNING id INTO notification_id;

  RETURN notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
