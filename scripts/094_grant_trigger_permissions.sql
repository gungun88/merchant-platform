-- 为 trigger_group_reward 函数设置正确的权限

-- 1. 授予函数执行权限给 authenticated 用户
GRANT EXECUTE ON FUNCTION trigger_group_reward(UUID) TO authenticated;

-- 2. 授予函数执行权限给 service_role
GRANT EXECUTE ON FUNCTION trigger_group_reward(UUID) TO service_role;

-- 3. 确保函数可以访问所需的表（通过 SECURITY DEFINER 已经处理）
-- trigger_group_reward 函数使用 SECURITY DEFINER，所以它会以定义者的权限运行

-- 4. 检查函数是否正确创建为 SECURITY DEFINER
SELECT
  proname as function_name,
  prosecdef as is_security_definer,
  proowner::regrole as owner
FROM pg_proc
WHERE proname = 'trigger_group_reward';

-- 如果 is_security_definer 显示为 false，需要重新创建函数
-- 091 脚本中已经包含 SECURITY DEFINER，所以应该是 true
