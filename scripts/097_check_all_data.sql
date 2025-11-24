-- 直接检查所有表的数据

-- 1. 检查 user_groups 表
SELECT * FROM public.user_groups;

-- 2. 检查 user_group_members 表（所有记录）
SELECT * FROM public.user_group_members;

-- 3. 检查 group_reward_rules 表（所有记录）
SELECT * FROM public.group_reward_rules;

-- 4. 检查表是否存在且有正确的结构
SELECT
    table_name,
    column_name,
    data_type
FROM information_schema.columns
WHERE table_schema = 'public'
    AND table_name IN ('user_groups', 'user_group_members', 'group_reward_rules')
ORDER BY table_name, ordinal_position;
