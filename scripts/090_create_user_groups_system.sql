-- 创建用户组系统和定时积分发放功能

-- 步骤1: 创建用户组表
CREATE TABLE IF NOT EXISTS public.user_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE public.user_groups IS '用户组表,用于分组管理用户';
COMMENT ON COLUMN public.user_groups.name IS '用户组名称,唯一';
COMMENT ON COLUMN public.user_groups.description IS '用户组描述';

-- 步骤2: 创建用户组成员表
CREATE TABLE IF NOT EXISTS public.user_group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.user_groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  added_by UUID REFERENCES auth.users(id),
  UNIQUE(group_id, user_id)
);

COMMENT ON TABLE public.user_group_members IS '用户组成员关联表';
COMMENT ON COLUMN public.user_group_members.added_by IS '添加该成员的管理员ID';

CREATE INDEX idx_user_group_members_group ON public.user_group_members(group_id);
CREATE INDEX idx_user_group_members_user ON public.user_group_members(user_id);

-- 步骤3: 创建用户组奖励规则表
CREATE TABLE IF NOT EXISTS public.group_reward_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.user_groups(id) ON DELETE CASCADE,
  coins_amount INTEGER NOT NULL CHECK (coins_amount > 0),
  reward_type VARCHAR(20) NOT NULL DEFAULT 'monthly' CHECK (reward_type IN ('daily', 'weekly', 'monthly', 'custom')),
  custom_day_of_month INTEGER CHECK (custom_day_of_month >= 1 AND custom_day_of_month <= 31),
  custom_day_of_week INTEGER CHECK (custom_day_of_week >= 0 AND custom_day_of_week <= 6),
  next_reward_date DATE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(group_id)
);

COMMENT ON TABLE public.group_reward_rules IS '用户组积分发放规则表';
COMMENT ON COLUMN public.group_reward_rules.coins_amount IS '每次发放的积分数量';
COMMENT ON COLUMN public.group_reward_rules.reward_type IS '发放周期类型: daily=每日, weekly=每周, monthly=每月, custom=自定义';
COMMENT ON COLUMN public.group_reward_rules.custom_day_of_month IS '每月的第几天发放(1-31),仅当reward_type=monthly或custom时使用';
COMMENT ON COLUMN public.group_reward_rules.custom_day_of_week IS '每周的第几天发放(0=周日,6=周六),仅当reward_type=weekly时使用';
COMMENT ON COLUMN public.group_reward_rules.next_reward_date IS '下次发放日期';
COMMENT ON COLUMN public.group_reward_rules.is_active IS '规则是否启用';

CREATE INDEX idx_group_reward_rules_next_date ON public.group_reward_rules(next_reward_date, is_active);

-- 步骤4: 创建用户组奖励发放日志表
CREATE TABLE IF NOT EXISTS public.group_reward_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.user_groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  coins_amount INTEGER NOT NULL,
  reward_date DATE NOT NULL,
  executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  transaction_id UUID REFERENCES public.point_transactions(id)
);

COMMENT ON TABLE public.group_reward_logs IS '用户组积分发放日志';
COMMENT ON COLUMN public.group_reward_logs.reward_date IS '计划发放日期';
COMMENT ON COLUMN public.group_reward_logs.executed_at IS '实际执行时间';
COMMENT ON COLUMN public.group_reward_logs.transaction_id IS '关联的积分交易记录ID';

CREATE INDEX idx_group_reward_logs_group ON public.group_reward_logs(group_id);
CREATE INDEX idx_group_reward_logs_user ON public.group_reward_logs(user_id);
CREATE INDEX idx_group_reward_logs_date ON public.group_reward_logs(reward_date);

-- 步骤5: 启用RLS
ALTER TABLE public.user_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_reward_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_reward_logs ENABLE ROW LEVEL SECURITY;

-- 步骤6: 创建RLS策略 - 仅管理员可以管理
CREATE POLICY "Admins can manage user groups"
  ON public.user_groups
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.role = 'admin' OR profiles.role = 'super_admin')
    )
  );

CREATE POLICY "Admins can manage group members"
  ON public.user_group_members
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.role = 'admin' OR profiles.role = 'super_admin')
    )
  );

CREATE POLICY "Admins can manage reward rules"
  ON public.group_reward_rules
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.role = 'admin' OR profiles.role = 'super_admin')
    )
  );

CREATE POLICY "Admins can view reward logs"
  ON public.group_reward_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.role = 'admin' OR profiles.role = 'super_admin')
    )
  );

-- 用户可以查看自己的发放日志
CREATE POLICY "Users can view their own reward logs"
  ON public.group_reward_logs
  FOR SELECT
  USING (user_id = auth.uid());

-- 步骤7: 创建自动更新updated_at的触发器
CREATE OR REPLACE FUNCTION update_group_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_user_groups_updated_at
  BEFORE UPDATE ON public.user_groups
  FOR EACH ROW
  EXECUTE FUNCTION update_group_updated_at();

CREATE TRIGGER trigger_update_group_reward_rules_updated_at
  BEFORE UPDATE ON public.group_reward_rules
  FOR EACH ROW
  EXECUTE FUNCTION update_group_updated_at();

-- 步骤8: 创建处理用户组积分发放的函数
CREATE OR REPLACE FUNCTION process_group_rewards()
RETURNS TABLE(
  processed_count INTEGER,
  failed_count INTEGER,
  details JSONB
) AS $$
DECLARE
  rule_record RECORD;
  member_record RECORD;
  new_transaction_id UUID;
  processed INTEGER := 0;
  failed INTEGER := 0;
  results JSONB := '[]'::JSONB;
  next_date DATE;
BEGIN
  -- 遍历所有需要今天发放的规则
  FOR rule_record IN
    SELECT r.*, g.name as group_name
    FROM public.group_reward_rules r
    JOIN public.user_groups g ON g.id = r.group_id
    WHERE r.is_active = true
    AND r.next_reward_date <= CURRENT_DATE
  LOOP
    -- 遍历该组的所有成员
    FOR member_record IN
      SELECT m.user_id, p.email
      FROM public.user_group_members m
      JOIN public.profiles p ON p.id = m.user_id
      WHERE m.group_id = rule_record.group_id
    LOOP
      BEGIN
        -- 检查是否已经发放过(避免重复发放)
        IF NOT EXISTS (
          SELECT 1 FROM public.group_reward_logs
          WHERE group_id = rule_record.group_id
          AND user_id = member_record.user_id
          AND reward_date = rule_record.next_reward_date
        ) THEN
          -- 使用系统的积分记录函数创建交易记录
          new_transaction_id := public.record_point_transaction(
            member_record.user_id,
            rule_record.coins_amount,
            'group_reward',
            format('用户组 "%s" 定期积分发放', rule_record.group_name),
            NULL,
            NULL,
            jsonb_build_object('group_id', rule_record.group_id, 'group_name', rule_record.group_name)
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
            rule_record.group_id,
            member_record.user_id,
            rule_record.coins_amount,
            rule_record.next_reward_date,
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
            format('您已获得用户组 "%s" 的定期积分奖励 %s 积分', rule_record.group_name, rule_record.coins_amount)
          );

          processed := processed + 1;
        END IF;
      EXCEPTION WHEN OTHERS THEN
        failed := failed + 1;
        results := results || jsonb_build_object(
          'group_id', rule_record.group_id,
          'user_id', member_record.user_id,
          'error', SQLERRM
        );
      END;
    END LOOP;

    -- 计算下次发放日期
    CASE rule_record.reward_type
      WHEN 'daily' THEN
        next_date := rule_record.next_reward_date + INTERVAL '1 day';
      WHEN 'weekly' THEN
        next_date := rule_record.next_reward_date + INTERVAL '7 days';
      WHEN 'monthly' THEN
        -- 如果指定了具体日期,使用该日期,否则使用下个月的同一天
        IF rule_record.custom_day_of_month IS NOT NULL THEN
          next_date := (DATE_TRUNC('month', rule_record.next_reward_date) + INTERVAL '1 month' +
                       (rule_record.custom_day_of_month - 1 || ' days')::INTERVAL)::DATE;
        ELSE
          next_date := rule_record.next_reward_date + INTERVAL '1 month';
        END IF;
      WHEN 'custom' THEN
        -- 自定义类型默认加1个月
        IF rule_record.custom_day_of_month IS NOT NULL THEN
          next_date := (DATE_TRUNC('month', rule_record.next_reward_date) + INTERVAL '1 month' +
                       (rule_record.custom_day_of_month - 1 || ' days')::INTERVAL)::DATE;
        ELSE
          next_date := rule_record.next_reward_date + INTERVAL '1 month';
        END IF;
    END CASE;

    -- 更新规则的下次发放日期
    UPDATE public.group_reward_rules
    SET next_reward_date = next_date,
        updated_at = NOW()
    WHERE id = rule_record.id;
  END LOOP;

  RETURN QUERY SELECT processed, failed, results;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION process_group_rewards() IS '处理用户组积分定期发放,由定时任务调用';

-- 步骤9: 创建手动触发单个组发放的函数(用于测试)
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
  END LOOP;

  RETURN QUERY SELECT true, format('成功发放给 %s 个用户', processed), processed;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION trigger_group_reward(UUID) IS '手动触发指定用户组的积分发放(管理员功能)';
