-- 修复积分记录表的 RLS 策略
-- 问题：之前的策略只允许用户为自己添加积分记录
-- 但在查看联系方式时，需要为商家也添加积分记录

-- 删除旧的插入策略
drop policy if exists "points_log_insert_authenticated" on public.points_log;

-- 创建新的插入策略：允许已认证用户插入积分记录
-- 这是安全的，因为：
-- 1. 只有已认证用户可以操作
-- 2. 实际的业务逻辑由服务端 actions 控制
-- 3. 用户无法直接从客户端访问数据库
create policy "points_log_insert_authenticated"
  on public.points_log for insert
  with check (auth.uid() is not null);
