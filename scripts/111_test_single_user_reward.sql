-- 测试为什么能找到成员但发放失败

DO $$
DECLARE
  test_user_id UUID;
  test_group_name TEXT := '论坛广告商家';
  test_amount INTEGER := 100;
  test_transaction_id UUID;
BEGIN
  -- 获取第一个成员的 user_id
  SELECT user_id INTO test_user_id
  FROM public.user_group_members
  WHERE group_id = '1ad7c993-0dbd-4e35-881d-6ad2aad7f092'
  LIMIT 1;

  IF test_user_id IS NULL THEN
    RAISE NOTICE '错误: 找不到任何成员';
    RETURN;
  END IF;

  RAISE NOTICE '测试用户ID: %', test_user_id;

  -- 测试1: 调用 record_point_transaction 函数
  BEGIN
    test_transaction_id := public.record_point_transaction(
      test_user_id,
      test_amount,
      'group_reward',
      format('用户组 "%s" 手动积分发放', test_group_name),
      NULL,
      NULL,
      jsonb_build_object(
        'group_id', '1ad7c993-0dbd-4e35-881d-6ad2aad7f092',
        'group_name', test_group_name,
        'manual', true
      )
    );
    RAISE NOTICE '✓ 测试1通过: 成功创建交易记录, transaction_id: %', test_transaction_id;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '✗ 测试1失败: record_point_transaction 调用失败';
    RAISE NOTICE '  错误: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
    RETURN;
  END;

  -- 测试2: 更新 profiles 表
  BEGIN
    UPDATE public.profiles
    SET points = COALESCE(points, 0) + test_amount
    WHERE id = test_user_id;
    RAISE NOTICE '✓ 测试2通过: 成功更新用户积分';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '✗ 测试2失败: 更新 profiles 表失败';
    RAISE NOTICE '  错误: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
    RETURN;
  END;

  -- 测试3: 插入 group_reward_logs
  BEGIN
    INSERT INTO public.group_reward_logs (
      group_id,
      user_id,
      coins_amount,
      reward_date,
      transaction_id
    ) VALUES (
      '1ad7c993-0dbd-4e35-881d-6ad2aad7f092',
      test_user_id,
      test_amount,
      CURRENT_DATE,
      test_transaction_id
    );
    RAISE NOTICE '✓ 测试3通过: 成功插入发放日志';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '✗ 测试3失败: 插入 group_reward_logs 失败';
    RAISE NOTICE '  错误: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
    RETURN;
  END;

  -- 测试4: 插入 user_notifications
  BEGIN
    INSERT INTO public.user_notifications (
      user_id,
      type,
      title,
      message
    ) VALUES (
      test_user_id,
      'group_reward',
      '定期积分到账',
      format('您已获得用户组 "%s" 的积分奖励 %s 积分', test_group_name, test_amount)
    );
    RAISE NOTICE '✓ 测试4通过: 成功创建通知';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '✗ 测试4失败: 插入 user_notifications 失败';
    RAISE NOTICE '  错误: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
    RETURN;
  END;

  RAISE NOTICE '========================================';
  RAISE NOTICE '所有测试通过! 单个用户发放流程完全正常';
  RAISE NOTICE '========================================';

  -- 回滚测试数据(不要实际保存)
  RAISE EXCEPTION '测试完成,回滚所有更改';

EXCEPTION WHEN OTHERS THEN
  IF SQLERRM = '测试完成,回滚所有更改' THEN
    RAISE NOTICE '测试数据已回滚';
  ELSE
    RAISE NOTICE '未预期的错误: %', SQLERRM;
  END IF;
END $$;
