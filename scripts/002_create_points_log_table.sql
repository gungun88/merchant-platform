-- 创建积分记录表
create table if not exists public.points_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  points_change integer not null, -- 积分变化（正数为增加，负数为减少）
  action_type text not null, -- 操作类型：register, sign_in, view_contact, publish_service, etc.
  description text, -- 描述
  related_user_id uuid references public.profiles(id) on delete set null, -- 关联的用户ID（如被查看的商家）
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 启用行级安全
alter table public.points_log enable row level security;

-- RLS 策略：用户只能查看自己的积分记录
create policy "points_log_select_own"
  on public.points_log for select
  using (auth.uid() = user_id);

-- RLS 策略：系统可以插入积分记录（通过服务端）
create policy "points_log_insert_authenticated"
  on public.points_log for insert
  with check (auth.uid() = user_id);

-- 创建索引以提高查询性能
create index if not exists points_log_user_id_idx on public.points_log(user_id);
create index if not exists points_log_created_at_idx on public.points_log(created_at desc);
