-- 创建商家表
create table if not exists public.merchants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade unique,
  name text not null, -- 商家名称
  logo text, -- Logo URL
  description text, -- 详细描述
  short_desc text, -- 简短描述
  contact_wechat text, -- 微信
  contact_telegram text, -- Telegram
  contact_whatsapp text, -- WhatsApp
  contact_email text, -- 邮箱
  service_types text[] default '{}', -- 服务类型数组
  certifications text[] default '{}', -- 认证类型数组
  warranties text[] default '{}', -- 售后保障数组
  payment_methods text[] default '{}', -- 支付方式数组
  location text, -- 地区
  price_range text, -- 价格区间
  response_time integer default 5, -- 响应速度（分钟）
  is_online boolean default false, -- 是否在线
  stock_status text default 'sufficient', -- 库存状态
  is_active boolean default true, -- 是否激活
  is_topped boolean default false, -- 是否置顶
  topped_until timestamp with time zone, -- 置顶截止时间
  view_count integer default 0, -- 浏览次数
  favorite_count integer default 0, -- 收藏次数
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 启用行级安全
alter table public.merchants enable row level security;

-- RLS 策略：所有人可以查看激活的商家
create policy "merchants_select_active"
  on public.merchants for select
  using (is_active = true);

-- RLS 策略：用户可以插入自己的商家信息
create policy "merchants_insert_own"
  on public.merchants for insert
  with check (auth.uid() = user_id);

-- RLS 策略：用户只能更新自己的商家信息
create policy "merchants_update_own"
  on public.merchants for update
  using (auth.uid() = user_id);

-- 创建索引
create index if not exists merchants_user_id_idx on public.merchants(user_id);
create index if not exists merchants_is_active_idx on public.merchants(is_active);
create index if not exists merchants_is_topped_idx on public.merchants(is_topped, topped_until);
create index if not exists merchants_created_at_idx on public.merchants(created_at desc);

-- 创建更新 updated_at 的触发器
create trigger on_merchants_updated
  before update on public.merchants
  for each row
  execute function public.handle_updated_at();
