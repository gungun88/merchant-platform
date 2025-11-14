-- 创建自动下架过期置顶商家的函数

-- 1. 创建函数：自动将过期的置顶商家下架
CREATE OR REPLACE FUNCTION expire_topped_merchants()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- 将所有已过期的置顶商家状态设置为未置顶
  UPDATE public.merchants
  SET is_topped = false
  WHERE is_topped = true
    AND topped_until IS NOT NULL
    AND topped_until < NOW();
END;
$$;

-- 2. 创建 pg_cron 扩展（如果还没有的话）
-- 注意：pg_cron 需要在 Supabase 项目中启用
-- 在 Supabase Dashboard > Database > Extensions 中启用 pg_cron

-- 3. 创建定时任务，每小时执行一次检查
-- 这个语句需要在启用 pg_cron 扩展后执行
-- SELECT cron.schedule(
--   'expire-topped-merchants', -- 任务名称
--   '0 * * * *',               -- 每小时执行一次（在每小时的第0分钟）
--   $$SELECT expire_topped_merchants();$$
-- );

-- 4. 手动执行一次，立即下架所有过期的置顶
SELECT expire_topped_merchants();

-- 注意事项：
-- 1. 在 Supabase Dashboard 中启用 pg_cron 扩展
-- 2. 然后在 SQL Editor 中执行以下命令来设置定时任务：
--    SELECT cron.schedule('expire-topped-merchants', '0 * * * *', $$SELECT expire_topped_merchants();$$);
-- 3. 查看定时任务：SELECT * FROM cron.job;
-- 4. 删除定时任务（如需要）：SELECT cron.unschedule('expire-topped-merchants');
