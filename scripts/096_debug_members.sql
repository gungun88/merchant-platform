-- 调试：检查用户组成员数据

-- 1. 检查用户组ID
SELECT id, name FROM public.user_groups WHERE name LIKE '%广告商家%';

-- 2. 使用上面查询到的ID，检查该组有多少成员
-- 请将 'YOUR_GROUP_ID' 替换为实际的用户组ID
SELECT
    m.id,
    m.group_id,
    m.user_id,
    p.email,
    p.username,
    p.points
FROM public.user_group_members m
LEFT JOIN public.profiles p ON p.id = m.user_id
WHERE m.group_id = '1ad7c993-0dbd-4e35-881d-6ad2aad7f092'
ORDER BY p.email;

-- 3. 检查该组的发放规则
SELECT
    r.id,
    r.group_id,
    r.coins_amount,
    r.reward_type,
    r.is_active,
    r.next_reward_date,
    g.name as group_name
FROM public.group_reward_rules r
JOIN public.user_groups g ON g.id = r.group_id
WHERE r.group_id = '1ad7c993-0dbd-4e35-881d-6ad2aad7f092';

-- 4. 手动测试循环逻辑
DO $$
DECLARE
  member_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO member_count
  FROM public.user_group_members
  WHERE group_id = '1ad7c993-0dbd-4e35-881d-6ad2aad7f092';

  RAISE NOTICE '找到 % 个成员', member_count;
END $$;
