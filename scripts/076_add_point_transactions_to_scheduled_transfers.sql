-- ========================================
-- 修复定时转账：添加积分交易记录
-- ========================================

-- 强制删除旧函数
DROP FUNCTION IF EXISTS execute_scheduled_point_transfers() CASCADE;

-- 创建新函数（添加积分交易记录）
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
  formatted_date TEXT;
BEGIN
  -- 获取所有待执行的任务
  FOR task_record IN
    SELECT *
    FROM scheduled_point_transfers
    WHERE status = 'pending'
    AND scheduled_at <= now()
    ORDER BY scheduled_at ASC
  LOOP
    BEGIN
      -- 使用 +08 偏移量代替 Asia/Shanghai
      formatted_date := to_char(
        task_record.scheduled_at AT TIME ZONE 'UTC' AT TIME ZONE '+08',
        'YYYY年FMMM月FMDD日 HH24:MI'
      );

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

          -- 计算新积分
          DECLARE
            new_points INTEGER;
          BEGIN
            new_points := (COALESCE(target_users.points, 0) + task_record.points);

            -- 更新用户积分
            UPDATE profiles
            SET points = new_points,
                updated_at = now()
            WHERE id = target_users.id;

            -- ★★★ 新增：创建积分交易记录 ★★★
            INSERT INTO point_transactions (user_id, amount, balance_after, type, description)
            VALUES (
              target_users.id,
              task_record.points,
              new_points,
              'points_reward',
              format('%s（活动日期：%s）', task_record.reason, formatted_date)
            );

            -- 创建通知（使用 +08 时区格式化的日期）
            INSERT INTO notifications (user_id, type, category, title, content, priority)
            VALUES (
              target_users.id,
              'points_reward',
              'system',
              '积分奖励',
              format('您获得了 %s 积分。原因：%s（活动日期：%s）。当前积分：%s',
                task_record.points,
                task_record.reason,
                formatted_date,
                new_points
              ),
              'normal'
            );
          END;

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

COMMENT ON FUNCTION execute_scheduled_point_transfers IS '执行定时积分转账任务（已添加积分交易记录）';

-- 验证
DO $$
BEGIN
  RAISE NOTICE '=== 修复完成 ===';
  RAISE NOTICE '已添加积分交易记录功能';
  RAISE NOTICE '现在定时转账会在 point_transactions 表中创建记录';
END $$;
