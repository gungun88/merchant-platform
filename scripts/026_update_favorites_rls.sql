-- 为 favorites 表添加新的 RLS 策略,允许商家查询收藏了自己商家的用户

-- 删除旧的 select 策略（如果存在）
drop policy if exists "favorites_select_own" on public.favorites;

-- 创建新的 select 策略：
-- 1. 用户可以查看自己的收藏
-- 2. 商家可以查看收藏了自己商家的记录
create policy "favorites_select_extended"
  on public.favorites for select
  using (
    auth.uid() = user_id
    OR
    merchant_id IN (
      select id from public.merchants
      where user_id = auth.uid()
    )
  );

-- 说明:
-- 这个策略允许:
-- 1. 用户查看自己的收藏记录 (auth.uid() = user_id)
-- 2. 商家查看所有收藏了自己商家的用户记录 (merchant_id IN (...))
