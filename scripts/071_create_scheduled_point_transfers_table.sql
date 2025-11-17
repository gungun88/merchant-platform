-- 创建定时积分转账任务表
CREATE TABLE IF NOT EXISTS scheduled_point_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 创建者信息
  created_by UUID NOT NULL REFERENCES auth.users(id),

  -- 转账配置
  points INTEGER NOT NULL CHECK (points > 0),
  reason TEXT NOT NULL,
  target_role TEXT NOT NULL DEFAULT 'all' CHECK (target_role IN ('all', 'user', 'merchant')),

  -- 定时信息
  scheduled_at TIMESTAMPTZ NOT NULL,

  -- 执行状态
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'executing', 'completed', 'failed', 'cancelled')),
  executed_at TIMESTAMPTZ,

  -- 执行结果
  total_users INTEGER,
  success_count INTEGER,
  fail_count INTEGER,
  error_message TEXT,

  -- 时间戳
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 创建索引
CREATE INDEX idx_scheduled_point_transfers_status ON scheduled_point_transfers(status);
CREATE INDEX idx_scheduled_point_transfers_scheduled_at ON scheduled_point_transfers(scheduled_at);
CREATE INDEX idx_scheduled_point_transfers_created_by ON scheduled_point_transfers(created_by);

-- 添加注释
COMMENT ON TABLE scheduled_point_transfers IS '定时积分转账任务表';
COMMENT ON COLUMN scheduled_point_transfers.points IS '每个用户获得的积分数';
COMMENT ON COLUMN scheduled_point_transfers.reason IS '转账原因';
COMMENT ON COLUMN scheduled_point_transfers.target_role IS '目标用户角色: all-所有用户, user-普通用户, merchant-商家用户';
COMMENT ON COLUMN scheduled_point_transfers.scheduled_at IS '计划执行时间';
COMMENT ON COLUMN scheduled_point_transfers.status IS '任务状态: pending-待执行, executing-执行中, completed-已完成, failed-失败, cancelled-已取消';

-- 添加 RLS 策略
ALTER TABLE scheduled_point_transfers ENABLE ROW LEVEL SECURITY;

-- 管理员可以查看所有任务
CREATE POLICY "管理员可以查看所有定时转账任务"
  ON scheduled_point_transfers
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- 管理员可以创建任务
CREATE POLICY "管理员可以创建定时转账任务"
  ON scheduled_point_transfers
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- 管理员可以更新任务
CREATE POLICY "管理员可以更新定时转账任务"
  ON scheduled_point_transfers
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- 管理员可以删除任务
CREATE POLICY "管理员可以删除定时转账任务"
  ON scheduled_point_transfers
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- 创建执行定时转账任务的函数
CREATE OR REPLACE FUNCTION execute_scheduled_point_transfers()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  task_record RECORD;
  target_users RECORD;
  success_cnt INTEGER := 0;
  fail_cnt INTEGER := 0;
  total_cnt INTEGER := 0;
BEGIN
  -- 获取所有待执行的任务（scheduled_at 已到且状态为 pending）
  FOR task_record IN
    SELECT *
    FROM scheduled_point_transfers
    WHERE status = 'pending'
    AND scheduled_at <= now()
    ORDER BY scheduled_at ASC
  LOOP
    BEGIN
      -- 更新任务状态为执行中
      UPDATE scheduled_point_transfers
      SET status = 'executing',
          updated_at = now()
      WHERE id = task_record.id;

      -- 根据目标角色获取用户列表
      FOR target_users IN
        SELECT p.id, p.points, p.username
        FROM profiles p
        WHERE p.is_banned = false
        AND p.role != 'admin'
        AND (
          task_record.target_role = 'all'
          OR (task_record.target_role = 'user' AND p.role = 'user')
          OR (task_record.target_role = 'merchant' AND EXISTS (
            SELECT 1 FROM merchants m WHERE m.user_id = p.id
          ))
        )
      LOOP
        BEGIN
          total_cnt := total_cnt + 1;

          -- 更新用户积分
          UPDATE profiles
          SET points = points + task_record.points,
              updated_at = now()
          WHERE id = target_users.id;

          -- 创建通知
          INSERT INTO notifications (user_id, type, category, title, content, priority)
          VALUES (
            target_users.id,
            'points_reward',
            'system',
            '积分奖励',
            format('您获得了 %s 积分。原因：%s（活动日期：%s）。当前积分：%s',
              task_record.points,
              task_record.reason,
              to_char(task_record.scheduled_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Shanghai', 'YYYY年FMMM月FMDD日 HH24:MI'),
              target_users.points + task_record.points
            ),
            'normal'
          );

          success_cnt := success_cnt + 1;
        EXCEPTION
          WHEN OTHERS THEN
            fail_cnt := fail_cnt + 1;
            RAISE WARNING '给用户 % 转账失败: %', target_users.id, SQLERRM;
        END;
      END LOOP;

      -- 更新任务状态为已完成
      UPDATE scheduled_point_transfers
      SET status = 'completed',
          executed_at = now(),
          total_users = total_cnt,
          success_count = success_cnt,
          fail_count = fail_cnt,
          updated_at = now()
      WHERE id = task_record.id;

      -- 重置计数器
      success_cnt := 0;
      fail_cnt := 0;
      total_cnt := 0;

    EXCEPTION
      WHEN OTHERS THEN
        -- 任务执行失败
        UPDATE scheduled_point_transfers
        SET status = 'failed',
            executed_at = now(),
            error_message = SQLERRM,
            updated_at = now()
        WHERE id = task_record.id;

        RAISE WARNING '定时转账任务 % 执行失败: %', task_record.id, SQLERRM;
    END;
  END LOOP;
END;
$$;

-- 创建定时任务（每分钟检查一次）
-- 注意：需要先启用 pg_cron 扩展
SELECT cron.schedule(
  'execute-scheduled-point-transfers',
  '* * * * *', -- 每分钟执行一次
  'SELECT execute_scheduled_point_transfers();'
);

COMMENT ON FUNCTION execute_scheduled_point_transfers IS '执行定时积分转账任务';
