-- 创建收藏表
create table if not exists public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(user_id, merchant_id) -- 防止重复收藏
);

-- 启用行级安全
alter table public.favorites enable row level security;

-- RLS 策略：用户只能查看自己的收藏
create policy "favorites_select_own"
  on public.favorites for select
  using (auth.uid() = user_id);

-- RLS 策略：用户只能添加自己的收藏
create policy "favorites_insert_own"
  on public.favorites for insert
  with check (auth.uid() = user_id);

-- RLS 策略：用户只能删除自己的收藏
create policy "favorites_delete_own"
  on public.favorites for delete
  using (auth.uid() = user_id);

-- 创建索引
create index if not exists favorites_user_id_idx on public.favorites(user_id);
create index if not exists favorites_merchant_id_idx on public.favorites(merchant_id);
