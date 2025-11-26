-- ============================================
-- 清理测试数据脚本
-- ============================================
-- 用途：清理所有测试业务数据，保留系统配置和管理员账户
-- 使用方法：在 Supabase SQL Editor 中执行
-- 警告：此操作不可逆，请谨慎使用！
-- ============================================

-- 开始事务
BEGIN;

-- 1. 清理押金相关数据
-- ============================================

-- 清理押金申请记录（如果表存在）
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'deposit_merchant_applications') THEN
    DELETE FROM deposit_merchant_applications;
    RAISE NOTICE '已清理 deposit_merchant_applications 表';
  ELSE
    RAISE NOTICE 'deposit_merchant_applications 表不存在，跳过';
  END IF;
END $$;

-- 清理押金退款申请记录（如果表存在）
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'deposit_refund_requests') THEN
    DELETE FROM deposit_refund_requests;
    RAISE NOTICE '已清理 deposit_refund_requests 表';
  ELSE
    RAISE NOTICE 'deposit_refund_requests 表不存在，跳过';
  END IF;
END $$;

-- 清理另一个押金退款申请表（如果表存在）
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'deposit_refund_applications') THEN
    DELETE FROM deposit_refund_applications;
    RAISE NOTICE '已清理 deposit_refund_applications 表';
  ELSE
    RAISE NOTICE 'deposit_refund_applications 表不存在，跳过';
  END IF;
END $$;

-- 清理追加押金申请记录（如果表存在）
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'deposit_top_up_applications') THEN
    DELETE FROM deposit_top_up_applications;
    RAISE NOTICE '已清理 deposit_top_up_applications 表';
  ELSE
    RAISE NOTICE 'deposit_top_up_applications 表不存在，跳过';
  END IF;
END $$;

-- 清理押金违规记录（如果表存在）
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'deposit_violation_records') THEN
    DELETE FROM deposit_violation_records;
    RAISE NOTICE '已清理 deposit_violation_records 表';
  ELSE
    RAISE NOTICE 'deposit_violation_records 表不存在，跳过';
  END IF;
END $$;

-- 重置用户的押金商家状态（如果字段存在）
DO $$
BEGIN
  IF EXISTS (
    SELECT FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'profiles'
    AND column_name = 'is_deposit_merchant'
  ) THEN
    UPDATE profiles
    SET
      is_deposit_merchant = FALSE,
      deposit_amount = 0,
      deposit_paid_at = NULL,
      deposit_expires_at = NULL
    WHERE is_deposit_merchant = TRUE;
    RAISE NOTICE '已重置用户押金商家状态';
  ELSE
    RAISE NOTICE 'profiles 表中无押金相关字段，跳过';
  END IF;
END $$;

-- 重置商家的押金商家状态（如果字段存在） - 用于前端显示
DO $$
BEGIN
  IF EXISTS (
    SELECT FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'merchants'
    AND column_name = 'is_deposit_merchant'
  ) THEN
    -- 只更新 is_deposit_merchant 字段（merchants表可能没有其他押金相关字段）
    UPDATE merchants
    SET is_deposit_merchant = FALSE
    WHERE is_deposit_merchant = TRUE;
    RAISE NOTICE '已重置商家押金商家状态（前端显示）';
  ELSE
    RAISE NOTICE 'merchants 表中无押金相关字段，跳过';
  END IF;
END $$;


-- 2. 清理合作伙伴相关数据
-- ============================================

-- 清理合作伙伴记录（如果表存在）
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'partners') THEN
    DELETE FROM partners;
    RAISE NOTICE '已清理 partners 表';
  ELSE
    RAISE NOTICE 'partners 表不存在，跳过';
  END IF;
END $$;


-- 3. 清理财务相关数据
-- ============================================

-- 先清理组团奖励记录（因为它引用了 point_transactions）
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'group_reward_logs') THEN
    DELETE FROM group_reward_logs;
    RAISE NOTICE '已清理 group_reward_logs 表';
  ELSE
    RAISE NOTICE 'group_reward_logs 表不存在，跳过';
  END IF;
END $$;

-- 清理积分交易记录（保留系统自动生成的注册奖励）
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'point_transactions') THEN
    DELETE FROM point_transactions
    WHERE type NOT IN ('registration', 'invitation_reward');
    RAISE NOTICE '已清理 point_transactions 表（保留注册奖励）';
  ELSE
    RAISE NOTICE 'point_transactions 表不存在，跳过';
  END IF;
END $$;

-- 清理硬币兑换记录
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'coin_exchange_records') THEN
    DELETE FROM coin_exchange_records;
    RAISE NOTICE '已清理 coin_exchange_records 表';
  ELSE
    RAISE NOTICE 'coin_exchange_records 表不存在，跳过';
  END IF;
END $$;

-- 重置用户积分（只保留注册奖励）
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'point_transactions') THEN
    UPDATE profiles
    SET points = COALESCE((
      SELECT SUM(amount)
      FROM point_transactions
      WHERE user_id = profiles.id
        AND type IN ('registration', 'invitation_reward')
    ), 0)
    WHERE EXISTS (
      SELECT 1 FROM point_transactions
      WHERE user_id = profiles.id
        AND type NOT IN ('registration', 'invitation_reward')
    );
    RAISE NOTICE '已重置用户积分为注册奖励金额';
  ELSE
    RAISE NOTICE 'point_transactions 表不存在，跳过积分重置';
  END IF;
END $$;


-- 4. 清理举报相关数据
-- ============================================

-- 清理举报记录
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'reports') THEN
    DELETE FROM reports;
    RAISE NOTICE '已清理 reports 表';
  ELSE
    RAISE NOTICE 'reports 表不存在，跳过';
  END IF;
END $$;

-- 重置商家信用分（恢复到初始100分）
DO $$
BEGIN
  IF EXISTS (
    SELECT FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'merchants'
    AND column_name = 'credit_score'
  ) THEN
    UPDATE merchants
    SET credit_score = 100
    WHERE credit_score != 100;
    RAISE NOTICE '已重置商家信用分为100';
  ELSE
    RAISE NOTICE 'merchants 表中无 credit_score 字段，跳过';
  END IF;
END $$;

-- 重置用户举报次数
DO $$
BEGIN
  IF EXISTS (
    SELECT FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'profiles'
    AND column_name = 'report_count'
  ) THEN
    UPDATE profiles
    SET report_count = 0
    WHERE report_count > 0;
    RAISE NOTICE '已重置用户举报次数';
  ELSE
    RAISE NOTICE 'profiles 表中无 report_count 字段，跳过';
  END IF;
END $$;


-- 5. 清理管理员操作日志
-- ============================================

-- 清理管理员操作日志
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'admin_logs') THEN
    DELETE FROM admin_logs;
    RAISE NOTICE '已清理 admin_logs 表';
  ELSE
    RAISE NOTICE 'admin_logs 表不存在，跳过';
  END IF;
END $$;


-- 6. 清理通知数据
-- ============================================

-- 清理所有通知（除了系统公告类型）
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'notifications') THEN
    DELETE FROM notifications
    WHERE type != 'system';
    RAISE NOTICE '已清理 notifications 表（保留系统公告）';
  ELSE
    RAISE NOTICE 'notifications 表不存在，跳过';
  END IF;
END $$;


-- 7. 清理商家相关测试数据
-- ============================================

-- 清理商家查看联系方式记录
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'merchant_contact_views') THEN
    DELETE FROM merchant_contact_views;
    RAISE NOTICE '已清理 merchant_contact_views 表';
  ELSE
    RAISE NOTICE 'merchant_contact_views 表不存在，跳过';
  END IF;
END $$;

-- 清理商家笔记
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'merchant_notes') THEN
    DELETE FROM merchant_notes;
    RAISE NOTICE '已清理 merchant_notes 表';
  ELSE
    RAISE NOTICE 'merchant_notes 表不存在，跳过';
  END IF;
END $$;

-- 重置商家浏览次数
DO $$
BEGIN
  IF EXISTS (
    SELECT FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'merchants'
    AND column_name = 'view_count'
  ) THEN
    UPDATE merchants
    SET view_count = 0
    WHERE view_count > 0;
    RAISE NOTICE '已重置商家浏览次数';
  ELSE
    RAISE NOTICE 'merchants 表中无 view_count 字段，跳过';
  END IF;
END $$;


-- 8. 清理用户行为数据
-- ============================================

-- 清理签到记录
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'check_ins') THEN
    DELETE FROM check_ins;
    RAISE NOTICE '已清理 check_ins 表';
  ELSE
    RAISE NOTICE 'check_ins 表不存在，跳过';
  END IF;
END $$;

-- 重置用户签到相关字段
DO $$
BEGIN
  IF EXISTS (
    SELECT FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'profiles'
    AND column_name = 'last_checkin_at'
  ) THEN
    UPDATE profiles
    SET
      last_checkin_at = NULL,
      current_checkin_streak = 0,
      total_checkin_days = 0,
      last_checkin_notified = FALSE
    WHERE last_checkin_at IS NOT NULL;
    RAISE NOTICE '已重置用户签到相关字段';
  ELSE
    RAISE NOTICE 'profiles 表中无签到相关字段，跳过';
  END IF;
END $$;

-- 清理收藏记录
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'favorites') THEN
    DELETE FROM favorites;
    RAISE NOTICE '已清理 favorites 表';
  ELSE
    RAISE NOTICE 'favorites 表不存在，跳过';
  END IF;
END $$;

-- 清理邀请记录（保留邀请码，只清理使用记录）
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'invitations') THEN
    UPDATE invitations
    SET
      invitee_id = NULL,
      status = 'pending',
      inviter_rewarded = FALSE,
      invitee_rewarded = FALSE,
      completed_at = NULL
    WHERE status = 'completed';
    RAISE NOTICE '已重置 invitations 表使用状态';
  ELSE
    RAISE NOTICE 'invitations 表不存在，跳过';
  END IF;
END $$;


-- 9. 清理定时任务相关数据
-- ============================================

-- 清理计划积分转账记录
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'scheduled_point_transfers') THEN
    DELETE FROM scheduled_point_transfers;
    RAISE NOTICE '已清理 scheduled_point_transfers 表';
  ELSE
    RAISE NOTICE 'scheduled_point_transfers 表不存在，跳过';
  END IF;
END $$;


-- 10. 输出清理统计
-- ============================================

DO $$
DECLARE
  v_stats TEXT;
BEGIN
  v_stats := format(
    E'测试数据清理完成！\n' ||
    E'================================\n' ||
    E'已清理的数据：\n' ||
    E'- 押金申请记录 (deposit_merchant_applications)\n' ||
    E'- 押金退款申请记录 (deposit_refund_requests/applications)\n' ||
    E'- 押金追加申请记录 (deposit_top_up_applications)\n' ||
    E'- 押金违规记录 (deposit_violation_records)\n' ||
    E'- 合作伙伴记录\n' ||
    E'- 组团奖励记录\n' ||
    E'- 积分交易记录（保留注册奖励）\n' ||
    E'- 硬币兑换记录\n' ||
    E'- 举报记录\n' ||
    E'- 管理员操作日志\n' ||
    E'- 通知记录（保留系统公告）\n' ||
    E'- 商家查看记录\n' ||
    E'- 商家笔记\n' ||
    E'- 签到记录\n' ||
    E'- 收藏记录\n' ||
    E'- 邀请使用记录\n' ||
    E'- 定时任务记录\n' ||
    E'================================\n' ||
    E'保留的数据：\n' ||
    E'- 用户账户（profiles）\n' ||
    E'- 商家信息（merchants）\n' ||
    E'- 系统设置（system_settings）\n' ||
    E'- 公告信息（announcements）\n' ||
    E'- 管理员权限\n' ||
    E'- 注册和邀请奖励积分\n' ||
    E'================================\n'
  );

  RAISE NOTICE '%', v_stats;
END $$;


-- 提交事务
COMMIT;

-- ============================================
-- 脚本执行完成
-- ============================================

-- 如果需要回滚，请在执行前使用：
-- BEGIN;
-- ... 执行脚本 ...
-- ROLLBACK; -- 不提交，回滚所有更改

-- 验证清理结果的查询：
/*
-- 查看各表的数据量
SELECT 'deposit_applications' as table_name, COUNT(*) as count FROM deposit_applications
UNION ALL
SELECT 'deposit_refund_applications', COUNT(*) FROM deposit_refund_applications
UNION ALL
SELECT 'partners', COUNT(*) FROM partners
UNION ALL
SELECT 'point_transactions', COUNT(*) FROM point_transactions
UNION ALL
SELECT 'coin_exchange_records', COUNT(*) FROM coin_exchange_records
UNION ALL
SELECT 'reports', COUNT(*) FROM reports
UNION ALL
SELECT 'admin_logs', COUNT(*) FROM admin_logs
UNION ALL
SELECT 'notifications', COUNT(*) FROM notifications
UNION ALL
SELECT 'check_ins', COUNT(*) FROM check_ins
UNION ALL
SELECT 'favorites', COUNT(*) FROM favorites
UNION ALL
SELECT 'scheduled_point_transfers', COUNT(*) FROM scheduled_point_transfers;

-- 查看用户积分情况
SELECT
  id,
  username,
  points,
  is_deposit_merchant,
  deposit_amount
FROM profiles
LIMIT 10;
*/
