-- 测试 trigger_group_reward 函数是否能查询到成员

-- 测试1: 直接在 SQL 中模拟函数的查询逻辑
DO $$
DECLARE
  member_count INTEGER;
  rule_count INTEGER;
BEGIN
  -- 检查规则
  SELECT COUNT(*) INTO rule_count
  FROM public.group_reward_rules r
  WHERE r.group_id = '1ad7c993-0dbd-4e35-881d-6ad2aad7f092' AND r.is_active = true;

  RAISE NOTICE '找到 % 个活跃规则', rule_count;

  -- 检查成员
  SELECT COUNT(*) INTO member_count
  FROM public.user_group_members
  WHERE group_id = '1ad7c993-0dbd-4e35-881d-6ad2aad7f092';

  RAISE NOTICE '找到 % 个成员', member_count;

  -- 列出所有成员
  FOR member_record IN
    SELECT user_id FROM public.user_group_members
    WHERE group_id = '1ad7c993-0dbd-4e35-881d-6ad2aad7f092'
  LOOP
    RAISE NOTICE '成员 user_id: %', member_record.user_id;
  END LOOP;
END $$;
