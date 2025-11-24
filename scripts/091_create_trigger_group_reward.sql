-- 创建手动触发用户组积分发放的函数
-- 功能: 管理员可以手动触发给指定用户组的所有成员发放积分

CREATE OR REPLACE FUNCTION trigger_group_reward(p_group_id UUID)
RETURNS TABLE(
  success BOOLEAN,
  message TEXT,
  processed_count INTEGER
) AS $$
DECLARE
  rule_record RECORD;
  member_record RECORD;
  new_transaction_id UUID;
  processed INTEGER := 0;
BEGIN
  -- 检查管理员权限
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND (role = 'admin' OR role = 'super_admin')
  ) THEN
    RETURN QUERY SELECT false, '权限不足'::TEXT, 0;
    RETURN;
  END IF;

  -- 获取规则
  SELECT r.*, g.name as group_name
  INTO rule_record
  FROM public.group_reward_rules r
  JOIN public.user_groups g ON g.id = r.group_id
  WHERE r.group_id = p_group_id AND r.is_active = true;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, '未找到启用的发放规则'::TEXT, 0;
    RETURN;
  END IF;

  -- 遍历该组的所有成员
  FOR member_record IN
    SELECT m.user_id, p.email
    FROM public.user_group_members m
    JOIN public.profiles p ON p.id = m.user_id
    WHERE m.group_id = p_group_id
  LOOP
    BEGIN
      -- 使用系统的积分记录函数创建交易记录
      new_transaction_id := public.record_point_transaction(
        member_record.user_id,
        rule_record.coins_amount,
        'group_reward',
        format('用户组 "%s" 手动积分发放', rule_record.group_name),
        NULL,
        NULL,
        jsonb_build_object('group_id', rule_record.group_id, 'group_name', rule_record.group_name, 'manual', true)
      );

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

      -- 创建通知
      INSERT INTO public.user_notifications (
        user_id,
        type,
        title,
        message
      ) VALUES (
        member_record.user_id,
        'group_reward',
        '定期积分到账',
        format('您已获得用户组 "%s" 的积分奖励 %s 积分', rule_record.group_name, rule_record.coins_amount)
      );

      processed := processed + 1;
    EXCEPTION WHEN OTHERS THEN
      -- 如果某个成员发放失败,继续处理其他成员
      RAISE WARNING '发放给用户 % 失败: %', member_record.user_id, SQLERRM;
    END;
  END LOOP;

  RETURN QUERY SELECT true, format('成功发放给 %s 个用户', processed), processed;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 添加函数注释
COMMENT ON FUNCTION trigger_group_reward(UUID) IS '手动触发指定用户组的积分发放(管理员功能)';
