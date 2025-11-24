-- 测试 trigger_group_reward 函数
-- 注意：请替换下面的 UUID 为你实际的用户组 ID

DO $$
DECLARE
  test_group_id UUID;
  result RECORD;
BEGIN
  -- 获取第一个用户组的 ID
  SELECT id INTO test_group_id FROM public.user_groups LIMIT 1;

  IF test_group_id IS NULL THEN
    RAISE NOTICE '没有找到任何用户组';
    RETURN;
  END IF;

  RAISE NOTICE '测试用户组 ID: %', test_group_id;

  -- 调用函数
  FOR result IN
    SELECT * FROM trigger_group_reward(test_group_id)
  LOOP
    RAISE NOTICE '成功: %, 消息: %, 处理数量: %',
      result.success, result.message, result.processed_count;
  END LOOP;

EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '错误代码: %', SQLSTATE;
  RAISE NOTICE '错误消息: %', SQLERRM;
  RAISE NOTICE '错误详情: %', SQLSTATE;
END $$;
