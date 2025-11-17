-- ========================================
-- 验证并修复定时转账时区问题
-- 执行此脚本前后请检查输出
-- ========================================

-- 第一步：显示当前时区设置
DO $$
BEGIN
  RAISE NOTICE '=== 当前数据库时区设置 ===';
  RAISE NOTICE 'SHOW timezone: %', current_setting('timezone');
  RAISE NOTICE '当前时间(now()): %', now();
  RAISE NOTICE '当前时间转中国时区: %', now() AT TIME ZONE 'Asia/Shanghai';
END $$;

-- 第二步：测试时区转换
DO $$
DECLARE
  test_utc TIMESTAMPTZ := '2025-11-15 03:31:00+00'::timestamptz;
  test_china TEXT;
BEGIN
  RAISE NOTICE '=== 时区转换测试 ===';
  RAISE NOTICE 'UTC时间: %', test_utc;

  test_china := to_char(
    test_utc AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Shanghai',
    'YYYY年FMMM月FMDD日 HH24:MI'
  );

  RAISE NOTICE '转换为中国时区: %', test_china;
  RAISE NOTICE '预期结果: 2025年11月15日 11:31 (UTC+8小时)';
END $$;

-- 第三步：强制删除旧函数
DROP FUNCTION IF EXISTS execute_scheduled_point_transfers() CASCADE;

-- 第四步：创建新函数（使用完全固定的时区转换）
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
      -- ★★★ 关键：预先格式化日期，转换为中国时区 ★★★
      formatted_date := to_char(
        task_record.scheduled_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Shanghai',
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

            -- ★★★ 创建通知（使用预先格式化的中国时区日期）★★★
            INSERT INTO notifications (user_id, type, category, title, content, priority)
            VALUES (
              target_users.id,
              'points_reward',
              'system',
              '积分奖励',
              format('您获得了 %s 积分。原因：%s（活动日期：%s）。当前积分：%s',
                task_record.points,
                task_record.reason,
                formatted_date,  -- 使用预先格式化的中国时区日期
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

COMMENT ON FUNCTION execute_scheduled_point_transfers IS '执行定时积分转账任务（UTC时间转中国时区）';

-- 第五步：验证函数已更新
DO $$
BEGIN
  RAISE NOTICE '=== 函数更新完成 ===';
  RAISE NOTICE '函数名: execute_scheduled_point_transfers';
  RAISE NOTICE '请检查上面的时区转换测试结果';
  RAISE NOTICE '如果测试显示 11:31（而不是 03:31），说明时区转换正常';
END $$;
