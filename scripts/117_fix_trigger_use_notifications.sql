-- 修复 trigger_group_reward 函数,使用正确的 notifications 表

CREATE OR REPLACE FUNCTION public.trigger_group_reward(p_group_id UUID)
RETURNS TABLE(
  success BOOLEAN,
  message TEXT,
  processed_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rule_record RECORD;
  member_record RECORD;
  new_transaction_id UUID;
  processed INTEGER := 0;
  member_count INTEGER := 0;
  rule_count INTEGER := 0;
BEGIN
  -- 调试: 检查规则数量
  SELECT COUNT(*) INTO rule_count
  FROM public.group_reward_rules
  WHERE group_id = p_group_id AND is_active = true;

  RAISE NOTICE '调试: 找到 % 个活跃规则', rule_count;

  -- 获取规则
  SELECT
    r.id,
    r.group_id,
    r.coins_amount,
    r.reward_type,
    g.name as group_name
  INTO rule_record
  FROM public.group_reward_rules r
  JOIN public.user_groups g ON g.id = r.group_id
  WHERE r.group_id = p_group_id AND r.is_active = true;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, format('未找到启用的发放规则 (group_id: %s)', p_group_id)::TEXT, 0;
    RETURN;
  END IF;

  RAISE NOTICE '调试: 找到规则 - 组名: %, 积分: %', rule_record.group_name, rule_record.coins_amount;

  -- 调试: 检查成员数量
  SELECT COUNT(*) INTO member_count
  FROM public.user_group_members
  WHERE group_id = p_group_id;

  RAISE NOTICE '调试: 找到 % 个成员', member_count;

  IF member_count = 0 THEN
    RETURN QUERY SELECT false, format('该用户组没有成员 (找到规则但成员数为0)')::TEXT, 0;
    RETURN;
  END IF;

  -- 遍历该组的所有成员
  FOR member_record IN
    SELECT m.user_id
    FROM public.user_group_members m
    WHERE m.group_id = p_group_id
  LOOP
    BEGIN
      RAISE NOTICE '调试: 正在处理成员 user_id: %', member_record.user_id;

      -- 使用系统的积分记录函数创建交易记录
      new_transaction_id := public.record_point_transaction(
        member_record.user_id,
        rule_record.coins_amount,
        'group_reward',
        format('用户组 "%s" 手动积分发放', rule_record.group_name),
        NULL,
        NULL,
        jsonb_build_object(
          'group_id', rule_record.group_id,
          'group_name', rule_record.group_name,
          'manual', true
        )
      );

      RAISE NOTICE '调试: 创建交易记录 transaction_id: %', new_transaction_id;

      -- 更新用户积分余额
      UPDATE public.profiles
      SET points = COALESCE(points, 0) + rule_record.coins_amount
      WHERE id = member_record.user_id;

      -- 记录发放日志
      INSERT INTO public.group_reward_logs (
        group_id,
        user_id,
        coins_amount,
        reward_date,
        transaction_id
      ) VALUES (
        p_group_id,
        member_record.user_id,
        rule_record.coins_amount,
        CURRENT_DATE,
        new_transaction_id
      );

      -- 创建通知 - 使用正确的 notifications 表
      INSERT INTO public.notifications (
        user_id,
        type,
        category,
        title,
        content,
        priority,
        metadata
      ) VALUES (
        member_record.user_id,
        'group_reward',
        'points',
        '定期积分到账',
        format('您已获得用户组 "%s" 的积分奖励 %s 积分', rule_record.group_name, rule_record.coins_amount),
        'normal',
        jsonb_build_object(
          'group_id', rule_record.group_id,
          'group_name', rule_record.group_name,
          'amount', rule_record.coins_amount
        )
      );

      processed := processed + 1;
      RAISE NOTICE '调试: 成功发放给用户 %, 当前已处理: %', member_record.user_id, processed;

    EXCEPTION WHEN OTHERS THEN
      -- 如果某个成员发放失败,继续处理其他成员
      RAISE WARNING '发放给用户 % 失败: % (SQLSTATE: %)', member_record.user_id, SQLERRM, SQLSTATE;
    END;
  END LOOP;

  RAISE NOTICE '调试: 循环结束, 总共处理了 % 个用户', processed;

  RETURN QUERY SELECT true, format('成功发放给 %s 个用户 (总共 %s 个成员)', processed, member_count), processed;
END;
$$;

-- 添加函数注释
COMMENT ON FUNCTION public.trigger_group_reward(UUID) IS '手动触发指定用户组的积分发放(管理员功能) - 使用notifications表';

-- 授予执行权限
GRANT EXECUTE ON FUNCTION public.trigger_group_reward(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.trigger_group_reward(UUID) TO service_role;
