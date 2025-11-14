-- 创建硬币兑换积分记录表
-- 用于记录论坛硬币兑换商家平台积分的所有交易

CREATE TABLE IF NOT EXISTS coin_exchange_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 用户信息
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_email TEXT NOT NULL,

  -- 论坛相关信息
  forum_user_id TEXT NOT NULL, -- 论坛的用户ID
  forum_transaction_id TEXT NOT NULL UNIQUE, -- 论坛的交易ID（用于防重放）

  -- 兑换信息
  coin_amount INTEGER NOT NULL CHECK (coin_amount > 0), -- 消耗的硬币数量
  points_amount INTEGER NOT NULL CHECK (points_amount > 0), -- 获得的积分数量
  exchange_rate DECIMAL(10,2) NOT NULL DEFAULT 0.1, -- 兑换比例（1积分=10硬币，即0.1）

  -- 状态信息
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),

  -- 请求信息
  request_ip TEXT, -- 请求IP（用于安全审计）
  request_signature TEXT NOT NULL, -- 请求签名
  request_timestamp BIGINT NOT NULL, -- 请求时间戳（毫秒）

  -- 失败原因
  failure_reason TEXT,

  -- 时间戳
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE -- 完成时间
);

-- 创建索引以提高查询性能
CREATE INDEX idx_coin_exchange_user_id ON coin_exchange_records(user_id);
CREATE INDEX idx_coin_exchange_user_email ON coin_exchange_records(user_email);
CREATE INDEX idx_coin_exchange_forum_user_id ON coin_exchange_records(forum_user_id);
CREATE INDEX idx_coin_exchange_status ON coin_exchange_records(status);
CREATE INDEX idx_coin_exchange_created_at ON coin_exchange_records(created_at DESC);

-- 复合索引用于日限额查询
-- 注意：不使用 DATE() 函数，直接对完整时间戳建索引，查询时在 WHERE 条件中使用日期范围
CREATE INDEX idx_coin_exchange_daily_limit ON coin_exchange_records(user_email, created_at, status)
WHERE status = 'completed';

-- 启用 RLS
ALTER TABLE coin_exchange_records ENABLE ROW LEVEL SECURITY;

-- 用户只能查看自己的兑换记录
CREATE POLICY "Users can view own exchange records"
  ON coin_exchange_records
  FOR SELECT
  USING (auth.uid() = user_id);

-- 管理员可以查看所有记录
CREATE POLICY "Admins can view all exchange records"
  ON coin_exchange_records
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- 只允许通过 API 插入记录（使用 service_role 密钥）
-- 普通用户和管理员都不能直接插入
CREATE POLICY "Only service role can insert exchange records"
  ON coin_exchange_records
  FOR INSERT
  WITH CHECK (false);

-- 添加表注释
COMMENT ON TABLE coin_exchange_records IS '硬币兑换积分记录表 - 记录论坛硬币兑换商家平台积分的所有交易';
COMMENT ON COLUMN coin_exchange_records.forum_transaction_id IS '论坛的交易ID，用于防止重放攻击，必须唯一';
COMMENT ON COLUMN coin_exchange_records.coin_amount IS '消耗的硬币数量（论坛货币）';
COMMENT ON COLUMN coin_exchange_records.points_amount IS '获得的积分数量（商家平台积分）';
COMMENT ON COLUMN coin_exchange_records.exchange_rate IS '兑换比例：1积分需要多少硬币（默认0.1表示1积分=10硬币）';
COMMENT ON COLUMN coin_exchange_records.request_signature IS 'API请求签名，用于验证请求来源';
COMMENT ON COLUMN coin_exchange_records.request_timestamp IS '请求时间戳（毫秒），用于防重放攻击';
