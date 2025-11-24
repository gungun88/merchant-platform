-- 设置pg_cron定时任务来执行用户组积分发放

-- 步骤1: 确保pg_cron扩展已启用(需要超级用户权限,在Supabase Dashboard中启用)
-- CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 步骤2: 创建调用Edge Function的SQL函数
CREATE OR REPLACE FUNCTION invoke_process_group_rewards()
RETURNS void AS $$
DECLARE
  function_url TEXT;
  service_role_key TEXT;
  result JSON;
BEGIN
  -- 从Supabase配置中获取URL和Key(需要配置这些环境变量)
  -- 注意: 在实际部署时,需要在Supabase Dashboard中配置这些值
  function_url := current_setting('app.supabase_url', true) || '/functions/v1/process-group-rewards';
  service_role_key := current_setting('app.supabase_service_role_key', true);

  -- 使用http扩展调用Edge Function
  SELECT content::json INTO result
  FROM http((
    'POST',
    function_url,
    ARRAY[http_header('Authorization', 'Bearer ' || service_role_key)],
    'application/json',
    '{}'
  )::http_request);

  -- 记录执行结果
  RAISE NOTICE 'Group rewards processing completed: %', result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION invoke_process_group_rewards() IS '调用Edge Function处理用户组积分发放';

-- 步骤3: 使用pg_cron创建定时任务(每天早上9点执行)
-- 注意: 这个命令需要在Supabase SQL Editor中以超级用户身份执行
/*
SELECT cron.schedule(
  'process-group-rewards-daily',        -- 任务名称
  '0 9 * * *',                          -- Cron表达式: 每天早上9点
  $$SELECT invoke_process_group_rewards()$$
);
*/

-- 步骤4: 查看已创建的定时任务
-- SELECT * FROM cron.job;

-- 步骤5: 如果需要删除定时任务
-- SELECT cron.unschedule('process-group-rewards-daily');

-- ==================== 使用说明 ====================
/*
由于pg_cron需要超级用户权限,在Supabase中需要通过以下步骤设置:

方法一: 使用Supabase Dashboard (推荐)
1. 进入Supabase项目的Database设置
2. 启用pg_cron扩展
3. 在SQL Editor中执行上面的pg_cron.schedule命令

方法二: 使用Supabase平台的Cron Jobs (更简单)
1. 部署Edge Function:
   supabase functions deploy process-group-rewards

2. 在Supabase Dashboard中:
   - 进入 Edge Functions 页面
   - 找到 process-group-rewards 函数
   - 设置 Cron trigger: "0 9 * * *" (每天早上9点)

方法三: 使用外部定时服务
1. 使用GitHub Actions的scheduled workflow
2. 使用Vercel Cron Jobs
3. 使用任何其他Cron服务定期调用Edge Function

建议使用方法二,因为它最简单且完全在Supabase平台内管理。
*/

-- ==================== 测试命令 ====================
-- 手动测试发放函数
-- SELECT * FROM process_group_rewards();

-- 手动测试特定用户组的发放
-- SELECT * FROM trigger_group_reward('your-group-id-here');

-- 查看发放日志
-- SELECT * FROM group_reward_logs ORDER BY executed_at DESC LIMIT 10;
