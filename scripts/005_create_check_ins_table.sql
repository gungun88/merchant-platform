-- 创建签到表
create table if not exists public.check_ins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  check_in_date date not null default current_date,
  consecutive_days integer not null default 1, -- 连续签到天数
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(user_id, check_in_date) -- 每天只能签到一次
);

-- 启用行级安全
alter table public.check_ins enable row level security;

-- RLS 策略：用户只能查看自己的签到记录
create policy "check_ins_select_own"
  on public.check_ins for select
  using (auth.uid() = user_id);

-- RLS 策略：用户只能添加自己的签到记录
create policy "check_ins_insert_own"
  on public.check_ins for insert
  with check (auth.uid() = user_id);

-- 创建索引
create index if not exists check_ins_user_id_idx on public.check_ins(user_id);
create index if not exists check_ins_date_idx on public.check_ins(check_in_date desc);
