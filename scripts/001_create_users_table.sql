-- 创建用户扩展信息表
-- 注意：auth.users 表由 Supabase 自动管理，我们创建一个 profiles 表来存储额外信息

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  avatar text,
  points integer not null default 100, -- 注册时默认100积分
  is_merchant boolean not null default false, -- 是否是商家
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 启用行级安全
alter table public.profiles enable row level security;

-- RLS 策略：用户可以查看所有 profiles
create policy "profiles_select_all"
  on public.profiles for select
  using (true);

-- RLS 策略：用户只能插入自己的 profile
create policy "profiles_insert_own"
  on public.profiles for insert
  with check (auth.uid() = id);

-- RLS 策略：用户只能更新自己的 profile
create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id);

-- 创建触发器：当新用户注册时自动创建 profile
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username, points, is_merchant)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1)),
    100, -- 注册时给100积分
    false
  )
  on conflict (id) do nothing;
  
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- 创建更新 updated_at 的触发器
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$;

create trigger on_profiles_updated
  before update on public.profiles
  for each row
  execute function public.handle_updated_at();
