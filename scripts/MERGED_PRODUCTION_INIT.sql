-- =============================================
-- 完整生产环境初始化脚本（自动合并）
-- 生成时间: 2025-11-18T05:48:24.140Z
-- =============================================


-- =============================================
-- 文件: 001_create_users_table.sql
-- =============================================

-- 创建用户扩展信息表
-- 注意：auth.users 表由 Supabase 自动管理，我们创建一个 profiles 表来存储额外信息

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  avatar text,
  points integer not null default 100, -- 注册时默认100积分
  is_merchant boolean not null default false, -- 是否是商家
  role varchar(20) not null default 'user', -- 用户角色
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  constraint profiles_role_check check (role in ('user', 'merchant', 'admin', 'super_admin'))
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
  insert into public.profiles (id, username, points, is_merchant, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1)),
    100, -- 注册时给100积分
    false,
    'user' -- 默认角色为普通用户
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



-- =============================================
-- 文件: 002_create_points_log_table.sql
-- =============================================

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



-- =============================================
-- 文件: 003_create_merchants_table.sql
-- =============================================

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



-- =============================================
-- 文件: 004_create_favorites_table.sql
-- =============================================

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



-- =============================================
-- 文件: 005_create_check_ins_table.sql
-- =============================================

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



-- =============================================
-- 文件: 006_update_profiles_default.sql
-- =============================================

-- 修改profiles表，确保新注册用户默认不是商家
ALTER TABLE profiles 
ALTER COLUMN is_merchant SET DEFAULT false;

-- 更新触发器，确保新用户注册时is_merchant为false
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, points, is_merchant)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    100,
    false  -- 默认不是商家
  );
  
  -- 添加注册积分记录
  INSERT INTO public.points_log (user_id, points_change, action_type, description)
  VALUES (NEW.id, 100, 'register', '注册奖励');
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;



-- =============================================
-- 文件: 007_add_certification_status.sql
-- =============================================

-- 添加认证状态字段
ALTER TABLE public.merchants 
ADD COLUMN IF NOT EXISTS certification_status text DEFAULT '待认证';

-- 更新已有数据的库存状态（将英文改为中文）
UPDATE public.merchants 
SET stock_status = '充足' 
WHERE stock_status = 'sufficient';

-- 添加认证状态的检查约束
ALTER TABLE public.merchants
ADD CONSTRAINT check_certification_status 
CHECK (certification_status IN ('待认证', '已认证', '认证失败'));



-- =============================================
-- 文件: 008_fix_stock_status.sql
-- =============================================

-- 修复库存状态，将英文改为中文
UPDATE public.merchants 
SET stock_status = CASE 
  WHEN stock_status = 'sufficient' THEN '现货充足'
  WHEN stock_status = 'in_stock' THEN '现货充足'
  WHEN stock_status = 'low_stock' THEN '库存紧张'
  WHEN stock_status = 'pre_order' THEN '需预订'
  ELSE stock_status
END
WHERE stock_status IN ('sufficient', 'in_stock', 'low_stock', 'pre_order');

-- 添加注释
COMMENT ON COLUMN public.merchants.stock_status IS '库存状态：现货充足、库存紧张、需预订、500+现货、1000+现货';



-- =============================================
-- 文件: 009_add_contact_phone.sql
-- =============================================

-- 添加电话联系方式字段
ALTER TABLE public.merchants 
ADD COLUMN IF NOT EXISTS contact_phone text;

-- 添加注释
COMMENT ON COLUMN public.merchants.contact_phone IS '电话联系方式';



-- =============================================
-- 文件: 010_add_merchant_views.sql
-- =============================================

-- 创建增加商家浏览量的数据库函数
CREATE OR REPLACE FUNCTION increment_merchant_views(merchant_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE merchants
  SET views = COALESCE(views, 0) + 1
  WHERE id = merchant_id;
END;
$$;

-- 确保views字段存在（如果不存在则添加）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'merchants' AND column_name = 'views'
  ) THEN
    ALTER TABLE merchants ADD COLUMN views INTEGER DEFAULT 0;
  END IF;
END $$;



-- =============================================
-- 文件: 011_add_reports_and_status.sql
-- =============================================

-- 添加商家上架状态字段
ALTER TABLE merchants
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

COMMENT ON COLUMN merchants.is_active IS '商家是否上架（true=上架，false=下架）';

-- 创建举报表
CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  reporter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  details TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewing', 'resolved', 'rejected')),
  admin_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE reports IS '商家举报记录表';
COMMENT ON COLUMN reports.merchant_id IS '被举报的商家ID';
COMMENT ON COLUMN reports.reporter_id IS '举报人ID';
COMMENT ON COLUMN reports.reason IS '举报原因类型';
COMMENT ON COLUMN reports.details IS '举报详细说明';
COMMENT ON COLUMN reports.status IS '处理状态：pending=待处理，reviewing=审核中，resolved=已处理，rejected=已驳回';
COMMENT ON COLUMN reports.admin_notes IS '管理员备注';

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_reports_merchant_id ON reports(merchant_id);
CREATE INDEX IF NOT EXISTS idx_reports_reporter_id ON reports(reporter_id);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON reports(created_at DESC);

-- 添加更新时间触发器
CREATE OR REPLACE FUNCTION update_reports_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_reports_updated_at
  BEFORE UPDATE ON reports
  FOR EACH ROW
  EXECUTE FUNCTION update_reports_updated_at();

-- 设置RLS策略
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- 用户可以创建举报
CREATE POLICY "Users can create reports"
  ON reports FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = reporter_id);

-- 用户可以查看自己提交的举报
CREATE POLICY "Users can view their own reports"
  ON reports FOR SELECT
  TO authenticated
  USING (auth.uid() = reporter_id);

-- 商家可以查看针对自己的举报
CREATE POLICY "Merchants can view reports about them"
  ON reports FOR SELECT
  TO authenticated
  USING (
    merchant_id IN (
      SELECT id FROM merchants WHERE user_id = auth.uid()
    )
  );



-- =============================================
-- 文件: 012_add_is_active_only.sql
-- =============================================

-- 最简版本：只添加 is_active 字段
-- 如果您已经有 reports 表，只需要这个字段即可

-- 添加商家上架状态字段
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'merchants' AND column_name = 'is_active'
  ) THEN
    ALTER TABLE merchants ADD COLUMN is_active BOOLEAN DEFAULT true;
    RAISE NOTICE '✓ 已添加 merchants.is_active 字段';
  ELSE
    RAISE NOTICE '✓ merchants.is_active 字段已存在';
  END IF;
END $$;

-- 为所有现有商家设置为上架状态
UPDATE merchants SET is_active = true WHERE is_active IS NULL;

-- 验证
SELECT
  column_name,
  data_type,
  column_default
FROM information_schema.columns
WHERE table_name = 'merchants' AND column_name = 'is_active';



-- =============================================
-- 文件: 013_fix_merchants_rls_policies.sql
-- =============================================

-- 修复商家表RLS策略，允许商家查看和更新自己的记录（无论is_active状态）

-- 1. 删除旧的SELECT策略
DROP POLICY IF EXISTS "merchants_select_active" ON public.merchants;

-- 2. 创建新的SELECT策略：所有人可以查看激活的商家，或者商家可以查看自己的记录
CREATE POLICY "merchants_select_policy"
  ON public.merchants FOR SELECT
  USING (is_active = true OR auth.uid() = user_id);

-- 3. 验证策略
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'merchants'
ORDER BY policyname;



-- =============================================
-- 文件: 014_fix_points_log_rls.sql
-- =============================================

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



-- =============================================
-- 文件: 015_create_invitations_table.sql
-- =============================================

-- 创建邀请表
-- 用于记录用户邀请关系和奖励状态

-- 1. 创建邀请表
CREATE TABLE IF NOT EXISTS invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inviter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invitee_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  invitation_code TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'expired')),
  inviter_rewarded BOOLEAN DEFAULT false,
  invitee_rewarded BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- 2. 添加表注释
COMMENT ON TABLE invitations IS '用户邀请记录表';
COMMENT ON COLUMN invitations.inviter_id IS '邀请人ID';
COMMENT ON COLUMN invitations.invitee_id IS '被邀请人ID';
COMMENT ON COLUMN invitations.invitation_code IS '邀请码(唯一)';
COMMENT ON COLUMN invitations.status IS '状态: pending=待完成, completed=已完成, expired=已过期';
COMMENT ON COLUMN invitations.inviter_rewarded IS '邀请人是否已获得奖励';
COMMENT ON COLUMN invitations.invitee_rewarded IS '被邀请人是否已获得奖励';
COMMENT ON COLUMN invitations.completed_at IS '完成时间';

-- 3. 创建索引
CREATE INDEX IF NOT EXISTS idx_invitations_inviter_id ON invitations(inviter_id);
CREATE INDEX IF NOT EXISTS idx_invitations_invitee_id ON invitations(invitee_id);
CREATE INDEX IF NOT EXISTS idx_invitations_invitation_code ON invitations(invitation_code);
CREATE INDEX IF NOT EXISTS idx_invitations_status ON invitations(status);
CREATE INDEX IF NOT EXISTS idx_invitations_created_at ON invitations(created_at DESC);

-- 4. 启用 RLS
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;

-- 5. 创建 RLS 策略

-- 用户可以查看自己作为邀请人的记录
CREATE POLICY "Users can view their own invitations as inviter"
  ON invitations FOR SELECT
  TO authenticated
  USING (auth.uid() = inviter_id);

-- 用户可以查看自己作为被邀请人的记录
CREATE POLICY "Users can view their own invitations as invitee"
  ON invitations FOR SELECT
  TO authenticated
  USING (auth.uid() = invitee_id);

-- 用户可以创建邀请记录
CREATE POLICY "Users can create invitations"
  ON invitations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = inviter_id);

-- 允许更新邀请状态(通过服务端逻辑)
CREATE POLICY "Users can update their invitations"
  ON invitations FOR UPDATE
  TO authenticated
  USING (auth.uid() = inviter_id OR auth.uid() = invitee_id);

-- 6. 创建生成邀请码的函数
CREATE OR REPLACE FUNCTION generate_invitation_code()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  code TEXT;
  exists BOOLEAN;
BEGIN
  LOOP
    -- 生成8位随机字符串
    code := upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 8));

    -- 检查是否已存在
    SELECT EXISTS(SELECT 1 FROM invitations WHERE invitation_code = code) INTO exists;

    EXIT WHEN NOT exists;
  END LOOP;

  RETURN code;
END;
$$;

-- 7. 验证结果
DO $$
BEGIN
  RAISE NOTICE '✓ invitations 表已创建';
  RAISE NOTICE '✓ 索引已添加';
  RAISE NOTICE '✓ RLS策略已配置';
  RAISE NOTICE '✓ 邀请码生成函数已创建';
END $$;



-- =============================================
-- 文件: 016_update_invitation_structure.sql
-- =============================================

-- 修改邀请系统设计
-- 将邀请码存储在用户的 profile 中，而不是创建空的邀请记录

-- 1. 在 profiles 表中添加邀请码字段
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS invitation_code TEXT UNIQUE;

-- 2. 为邀请码字段添加索引
CREATE INDEX IF NOT EXISTS idx_profiles_invitation_code ON profiles(invitation_code);

-- 3. 添加注释
COMMENT ON COLUMN profiles.invitation_code IS '用户的专属邀请码';

-- 4. 修改 invitations 表的逻辑
-- invitations 表现在只用于记录真实的邀请关系（当被邀请人注册时才创建记录）
-- 删除之前自动生成的空记录
DELETE FROM invitations WHERE invitee_id IS NULL;

-- 5. 验证结果
DO $$
BEGIN
  RAISE NOTICE '✓ profiles 表已添加 invitation_code 字段';
  RAISE NOTICE '✓ 索引已添加';
  RAISE NOTICE '✓ 已清理空的邀请记录';
END $$;



-- =============================================
-- 文件: 017_fix_invitation_code_generation.sql
-- =============================================

-- 修复邀请码生成问题
-- 确保用户注册时自动生成邀请码

-- 1. 更新现有用户的邀请码(如果为空)
UPDATE profiles
SET invitation_code = generate_invitation_code()
WHERE invitation_code IS NULL;

-- 2. 修改 handle_new_user 触发器函数,在创建 profile 时自动生成邀请码
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
begin
  insert into public.profiles (id, username, points, is_merchant, invitation_code)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1)),
    100,  -- 注册赠送100积分
    false,
    generate_invitation_code()  -- 自动生成邀请码
  )
  on conflict (id) do nothing;

  -- 记录注册赠送的积分
  insert into public.points_logs (user_id, points, type, description)
  values (new.id, 100, 'registration', '注册赠送积分');

  return new;
end;
$function$;



-- =============================================
-- 文件: 018_fix_trigger_and_points_logs.sql
-- =============================================

-- 修复触发器和 points_log 表的 RLS 问题

-- 1. 删除所有旧的 RLS 策略
DROP POLICY IF EXISTS "points_log_select_own" ON public.points_log;
DROP POLICY IF EXISTS "points_log_insert_authenticated" ON public.points_log;

-- 2. 创建新的 RLS 策略
-- 用户可以查看自己的积分记录
CREATE POLICY "points_log_select_own"
  ON public.points_log FOR SELECT
  USING (auth.uid() = user_id);

-- 允许触发器函数插入积分记录（SECURITY DEFINER 函数可以绕过 RLS）
-- 使用 WITH CHECK (true) 允许系统插入任何记录
CREATE POLICY "points_log_insert_system"
  ON public.points_log FOR INSERT
  WITH CHECK (true);

-- 3. 更新触发器函数，添加 invitation_code 生成和 points_log 记录
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  -- 插入用户 profile，包含邀请码
  INSERT INTO public.profiles (id, username, points, is_merchant, invitation_code)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1)),
    100,
    false,
    generate_invitation_code()
  )
  ON CONFLICT (id) DO NOTHING;

  -- 记录注册积分
  INSERT INTO public.points_log (user_id, points_change, action_type, description)
  VALUES (new.id, 100, 'register', '注册赠送积分');

  RETURN new;
END;
$function$;



-- =============================================
-- 文件: 019_fix_invitations_rls.sql
-- =============================================

-- 修复 invitations 表的 RLS 策略

-- 1. 删除现有的 RLS 策略
DROP POLICY IF EXISTS "invitations_select_own" ON public.invitations;
DROP POLICY IF EXISTS "invitations_insert_authenticated" ON public.invitations;

-- 2. 创建新的 RLS 策略
-- 用户可以查看与自己相关的邀请记录（作为邀请人或被邀请人）
CREATE POLICY "invitations_select_own"
  ON public.invitations FOR SELECT
  USING (auth.uid() = inviter_id OR auth.uid() = invitee_id);

-- 允许已认证用户创建邀请记录（用于邀请奖励系统）
CREATE POLICY "invitations_insert_authenticated"
  ON public.invitations FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);



-- =============================================
-- 文件: 020_auto_expire_topped_merchants.sql
-- =============================================

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



-- =============================================
-- 文件: 021_enable_realtime_for_profiles.sql
-- =============================================

-- 启用 profiles 表的 Realtime 功能

-- 1. 为 profiles 表启用 Realtime 复制
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;

-- 注意：
-- 1. 这个命令会启用 profiles 表的实时更新功能
-- 2. 现在当 profiles 表中的数据发生变化时，前端会实时收到通知
-- 3. 这样商家的积分变化会立即反映在导航栏中，无需刷新页面

-- 验证是否成功启用：
-- SELECT schemaname, tablename
-- FROM pg_publication_tables
-- WHERE pubname = 'supabase_realtime';



-- =============================================
-- 文件: 022_create_point_transactions_table.sql
-- =============================================

-- 创建积分交易记录表
CREATE TABLE IF NOT EXISTS public.point_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL, -- 积分变动数量,正数为收入,负数为支出
  balance_after INTEGER NOT NULL, -- 交易后的余额
  type TEXT NOT NULL, -- 交易类型
  description TEXT NOT NULL, -- 详细描述
  related_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- 相关用户ID(邀请人等)
  related_merchant_id UUID REFERENCES public.merchants(id) ON DELETE SET NULL, -- 相关商家ID
  metadata JSONB, -- 额外信息
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 创建索引以优化查询性能
CREATE INDEX IF NOT EXISTS idx_point_transactions_user_id ON public.point_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_point_transactions_created_at ON public.point_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_point_transactions_type ON public.point_transactions(type);
CREATE INDEX IF NOT EXISTS idx_point_transactions_user_created ON public.point_transactions(user_id, created_at DESC);

-- 启用RLS
ALTER TABLE public.point_transactions ENABLE ROW LEVEL SECURITY;

-- RLS策略:用户只能查看自己的积分记录
CREATE POLICY "Users can view their own point transactions"
  ON public.point_transactions
  FOR SELECT
  USING (auth.uid() = user_id);

-- 插入策略:只允许通过服务器端函数插入(后续会创建)
CREATE POLICY "Service role can insert point transactions"
  ON public.point_transactions
  FOR INSERT
  WITH CHECK (true);

-- 启用Realtime(可选,如果需要实时更新积分记录)
ALTER PUBLICATION supabase_realtime ADD TABLE public.point_transactions;

-- 创建辅助函数:记录积分变动
CREATE OR REPLACE FUNCTION public.record_point_transaction(
  p_user_id UUID,
  p_amount INTEGER,
  p_type TEXT,
  p_description TEXT,
  p_related_user_id UUID DEFAULT NULL,
  p_related_merchant_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_points INTEGER;
  v_transaction_id UUID;
BEGIN
  -- 获取当前积分
  SELECT points INTO v_current_points
  FROM public.profiles
  WHERE id = p_user_id;

  IF v_current_points IS NULL THEN
    RAISE EXCEPTION 'User profile not found';
  END IF;

  -- 插入交易记录
  INSERT INTO public.point_transactions (
    user_id,
    amount,
    balance_after,
    type,
    description,
    related_user_id,
    related_merchant_id,
    metadata
  ) VALUES (
    p_user_id,
    p_amount,
    v_current_points + p_amount, -- 计算交易后余额
    p_type,
    p_description,
    p_related_user_id,
    p_related_merchant_id,
    p_metadata
  )
  RETURNING id INTO v_transaction_id;

  RETURN v_transaction_id;
END;
$$;

COMMENT ON TABLE public.point_transactions IS '积分交易记录表';
COMMENT ON COLUMN public.point_transactions.amount IS '积分变动数量,正数为收入,负数为支出';
COMMENT ON COLUMN public.point_transactions.balance_after IS '交易后的积分余额';
COMMENT ON COLUMN public.point_transactions.type IS '交易类型: registration, checkin, merchant_cert, invitation, view_contact, topped_promotion, system_adjustment';
COMMENT ON FUNCTION public.record_point_transaction IS '记录积分变动的辅助函数';



-- =============================================
-- 文件: 023_add_checkin_fields_to_profiles.sql
-- =============================================

-- 添加签到相关字段到 profiles 表
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS last_checkin TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS consecutive_checkin_days INTEGER DEFAULT 0;

-- 为现有用户设置默认值
UPDATE profiles
SET consecutive_checkin_days = 0
WHERE consecutive_checkin_days IS NULL;

-- 添加注释说明
COMMENT ON COLUMN profiles.last_checkin IS '最后签到时间';
COMMENT ON COLUMN profiles.consecutive_checkin_days IS '连续签到天数';



-- =============================================
-- 文件: 024_create_notifications_table.sql
-- =============================================

-- 创建通知表
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- 通知类型和分类
  type VARCHAR(50) NOT NULL, -- 'system', 'merchant', 'social', 'transaction'
  category VARCHAR(50) NOT NULL, -- 'checkin', 'favorite', 'merchant_update', 'contact_view', etc.

  -- 通知内容
  title VARCHAR(200) NOT NULL,
  content TEXT,

  -- 相关数据
  related_merchant_id UUID REFERENCES merchants(id) ON DELETE SET NULL,
  related_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  metadata JSONB, -- 存储额外数据（链接、参数等）

  -- 通知状态
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMP WITH TIME ZONE,

  -- 优先级
  priority VARCHAR(20) DEFAULT 'normal', -- 'high', 'normal', 'low'

  -- 时间戳
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE -- 过期时间（可选）
);

-- 创建索引优化查询性能
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, is_read) WHERE is_read = FALSE;

-- 添加表注释
COMMENT ON TABLE notifications IS '用户通知表';
COMMENT ON COLUMN notifications.type IS '通知类型: system-系统, merchant-商家, social-社交, transaction-交易';
COMMENT ON COLUMN notifications.category IS '通知分类: checkin-签到, favorite-收藏, merchant_update-商家更新, contact_view-查看联系方式等';
COMMENT ON COLUMN notifications.priority IS '优先级: high-高, normal-普通, low-低';

-- 启用 RLS (Row Level Security)
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- 创建 RLS 策略：用户只能查看自己的通知
CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  USING (auth.uid() = user_id);

-- 创建 RLS 策略：用户只能更新自己的通知（标记已读等）
CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  USING (auth.uid() = user_id);

-- 创建 RLS 策略：系统可以为任何用户创建通知
CREATE POLICY "System can insert notifications"
  ON notifications FOR INSERT
  WITH CHECK (true);

-- 创建 RLS 策略：用户可以删除自己的通知
CREATE POLICY "Users can delete own notifications"
  ON notifications FOR DELETE
  USING (auth.uid() = user_id);

-- 创建函数：获取用户未读通知数量
CREATE OR REPLACE FUNCTION get_unread_notification_count(p_user_id UUID)
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)::INTEGER
    FROM notifications
    WHERE user_id = p_user_id
      AND is_read = FALSE
      AND (expires_at IS NULL OR expires_at > NOW())
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 创建函数：批量标记通知为已读
CREATE OR REPLACE FUNCTION mark_notifications_as_read(p_user_id UUID, p_notification_ids UUID[])
RETURNS VOID AS $$
BEGIN
  UPDATE notifications
  SET is_read = TRUE,
      read_at = NOW()
  WHERE user_id = p_user_id
    AND id = ANY(p_notification_ids)
    AND is_read = FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 创建函数：标记所有通知为已读
CREATE OR REPLACE FUNCTION mark_all_notifications_as_read(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE notifications
  SET is_read = TRUE,
      read_at = NOW()
  WHERE user_id = p_user_id
    AND is_read = FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 创建函数：创建通知的辅助函数
CREATE OR REPLACE FUNCTION create_notification(
  p_user_id UUID,
  p_type VARCHAR(50),
  p_category VARCHAR(50),
  p_title VARCHAR(200),
  p_content TEXT DEFAULT NULL,
  p_related_merchant_id UUID DEFAULT NULL,
  p_related_user_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL,
  p_priority VARCHAR(20) DEFAULT 'normal',
  p_expires_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  notification_id UUID;
BEGIN
  INSERT INTO notifications (
    user_id, type, category, title, content,
    related_merchant_id, related_user_id, metadata,
    priority, expires_at
  )
  VALUES (
    p_user_id, p_type, p_category, p_title, p_content,
    p_related_merchant_id, p_related_user_id, p_metadata,
    p_priority, p_expires_at
  )
  RETURNING id INTO notification_id;

  RETURN notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;



-- =============================================
-- 文件: 025_setup_pg_cron.sql
-- =============================================

-- =====================================================
-- 设置 pg_cron 定时任务 - 商家置顶到期提醒系统
-- =====================================================

-- 1. 启用 pg_cron 扩展
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2. 创建检查即将到期置顶商家的函数
CREATE OR REPLACE FUNCTION check_expiring_top_merchants()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  merchant_record RECORD;
  days_left INTEGER;
  expiry_date TIMESTAMP WITH TIME ZONE;
  notification_id UUID;
BEGIN
  -- 查找3天内即将到期的置顶商家
  FOR merchant_record IN
    SELECT
      m.id,
      m.user_id,
      m.name,
      m.topped_until
    FROM merchants m
    WHERE m.is_topped = TRUE
      AND m.topped_until IS NOT NULL
      AND m.topped_until > NOW()  -- 还没过期
      AND m.topped_until <= NOW() + INTERVAL '3 days'  -- 3天内到期
  LOOP
    -- 计算剩余天数
    expiry_date := merchant_record.topped_until;
    days_left := CEIL(EXTRACT(EPOCH FROM (expiry_date - NOW())) / 86400);

    -- 检查是否已经发送过此通知(避免重复)
    -- 检查最近3天内是否有相同的通知
    IF NOT EXISTS (
      SELECT 1 FROM notifications
      WHERE user_id = merchant_record.user_id
        AND category = 'merchant_top_expiring'
        AND related_merchant_id = merchant_record.id
        AND created_at > NOW() - INTERVAL '3 days'
    ) THEN
      -- 创建到期提醒通知
      INSERT INTO notifications (
        user_id,
        type,
        category,
        title,
        content,
        related_merchant_id,
        metadata,
        priority
      ) VALUES (
        merchant_record.user_id,
        'merchant',
        'merchant_top_expiring',
        '商家置顶即将到期',
        '您的商家"' || merchant_record.name || '"的置顶服务将在 ' || days_left || ' 天后到期 (' || TO_CHAR(expiry_date, 'YYYY-MM-DD') || ')',
        merchant_record.id,
        jsonb_build_object(
          'expires_at', expiry_date,
          'days_left', days_left
        ),
        'high'
      );

      RAISE NOTICE '已发送到期提醒通知: 商家 % (剩余 % 天)', merchant_record.name, days_left;
    END IF;
  END LOOP;

  RAISE NOTICE '检查到期提醒任务完成';
END;
$$;

-- 添加函数注释
COMMENT ON FUNCTION check_expiring_top_merchants() IS '检查并发送即将到期(3天内)的置顶商家提醒通知';


-- 3. 创建自动下架过期置顶商家的函数
CREATE OR REPLACE FUNCTION expire_top_merchants()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  merchant_record RECORD;
  expired_count INTEGER := 0;
BEGIN
  -- 查找并更新已过期的置顶商家
  FOR merchant_record IN
    SELECT
      m.id,
      m.user_id,
      m.name
    FROM merchants m
    WHERE m.is_topped = TRUE
      AND m.topped_until IS NOT NULL
      AND m.topped_until < NOW()  -- 已过期
  LOOP
    -- 取消置顶状态
    UPDATE merchants
    SET
      is_topped = FALSE,
      topped_until = NULL
    WHERE id = merchant_record.id;

    -- 发送过期通知
    INSERT INTO notifications (
      user_id,
      type,
      category,
      title,
      content,
      related_merchant_id,
      priority
    ) VALUES (
      merchant_record.user_id,
      'merchant',
      'merchant_top_expired',
      '商家置顶已到期',
      '您的商家"' || merchant_record.name || '"的置顶服务已到期',
      merchant_record.id,
      'normal'
    );

    expired_count := expired_count + 1;
    RAISE NOTICE '已下架过期商家: %', merchant_record.name;
  END LOOP;

  RAISE NOTICE '自动下架任务完成,共处理 % 个商家', expired_count;
END;
$$;

-- 添加函数注释
COMMENT ON FUNCTION expire_top_merchants() IS '自动下架已过期的置顶商家并发送通知';


-- 4. 设置 pg_cron 定时任务
-- 注意: pg_cron 使用的是UTC时间,需要根据您的时区调整

-- 任务1: 每小时检查并下架过期的置顶商家
SELECT cron.schedule(
  'expire-top-merchants',           -- 任务名称
  '0 * * * *',                      -- Cron表达式: 每小时的第0分钟
  $$SELECT expire_top_merchants()$$ -- 要执行的SQL
);

-- 任务2: 每天上午10点(UTC时间凌晨2点 = 北京时间上午10点)检查即将到期的商家
SELECT cron.schedule(
  'check-expiring-top-merchants',           -- 任务名称
  '0 2 * * *',                              -- Cron表达式: 每天UTC时间2:00 (北京时间10:00)
  $$SELECT check_expiring_top_merchants()$$ -- 要执行的SQL
);

-- 5. 查看已创建的定时任务
-- SELECT * FROM cron.job;

-- 6. 如果需要删除任务,使用以下命令:
-- SELECT cron.unschedule('expire-top-merchants');
-- SELECT cron.unschedule('check-expiring-top-merchants');

-- =====================================================
-- 使用说明:
--
-- 1. 在 Supabase SQL Editor 中执行此脚本
-- 2. 定时任务会自动运行:
--    - 每小时检查并下架过期商家
--    - 每天上午10点(北京时间)发送到期提醒
-- 3. 可以手动测试函数:
--    SELECT check_expiring_top_merchants();
--    SELECT expire_top_merchants();
-- 4. 查看定时任务状态:
--    SELECT * FROM cron.job;
-- 5. 查看任务执行历史:
--    SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;
-- =====================================================



-- =============================================
-- 文件: 026_update_favorites_rls.sql
-- =============================================

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



-- =============================================
-- 文件: 027_create_deposit_merchant_system.sql
-- =============================================

-- =============================================
-- 押金商家系统数据库迁移脚本
-- 创建时间: 2025-10-30
-- 说明: 添加押金商家相关字段和功能
-- =============================================

-- 1. 添加押金商家相关字段到 merchants 表
ALTER TABLE merchants
ADD COLUMN IF NOT EXISTS is_deposit_merchant BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS deposit_amount DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS deposit_status VARCHAR(20) DEFAULT 'unpaid',
ADD COLUMN IF NOT EXISTS deposit_paid_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS deposit_refund_requested_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS deposit_refund_completed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS deposit_refund_fee_percentage INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_daily_login_reward_at TIMESTAMPTZ;

-- 2. 添加字段注释
COMMENT ON COLUMN merchants.is_deposit_merchant IS '是否为押金商家';
COMMENT ON COLUMN merchants.deposit_amount IS '押金金额(USDT)';
COMMENT ON COLUMN merchants.deposit_status IS '押金状态: unpaid(未缴纳), paid(已缴纳), refund_requested(申请退还), refunded(已退还), violated(违规扣除)';
COMMENT ON COLUMN merchants.deposit_paid_at IS '押金缴纳时间';
COMMENT ON COLUMN merchants.deposit_refund_requested_at IS '押金退还申请时间';
COMMENT ON COLUMN merchants.deposit_refund_completed_at IS '押金退还完成时间';
COMMENT ON COLUMN merchants.deposit_refund_fee_percentage IS '退还时收取的手续费百分比(0-100)';
COMMENT ON COLUMN merchants.last_daily_login_reward_at IS '最后一次领取每日登录奖励的时间';

-- 3. 创建押金商家申请记录表
CREATE TABLE IF NOT EXISTS deposit_merchant_applications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    deposit_amount DECIMAL(10, 2) NOT NULL DEFAULT 500.00,
    payment_proof_url TEXT, -- 支付凭证URL
    application_status VARCHAR(20) DEFAULT 'pending', -- pending(待审核), approved(已批准), rejected(已拒绝)
    admin_note TEXT, -- 管理员备注
    approved_by UUID REFERENCES auth.users(id),
    approved_at TIMESTAMPTZ,
    rejected_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE deposit_merchant_applications IS '押金商家申请记录表';
COMMENT ON COLUMN deposit_merchant_applications.application_status IS '申请状态: pending(待审核), approved(已批准), rejected(已拒绝)';

-- 4. 创建押金退还申请记录表
CREATE TABLE IF NOT EXISTS deposit_refund_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    original_deposit_amount DECIMAL(10, 2) NOT NULL,
    refund_fee_percentage INTEGER NOT NULL, -- 手续费百分比
    refund_fee_amount DECIMAL(10, 2) NOT NULL, -- 手续费金额
    refund_amount DECIMAL(10, 2) NOT NULL, -- 实际退还金额
    refund_account_info TEXT, -- 退款账户信息
    request_status VARCHAR(20) DEFAULT 'pending', -- pending(待处理), approved(已批准), rejected(已拒绝), completed(已完成)
    admin_note TEXT,
    approved_by UUID REFERENCES auth.users(id),
    approved_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    rejected_reason TEXT,
    deposit_paid_duration_days INTEGER, -- 押金缴纳天数
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE deposit_refund_requests IS '押金退还申请记录表';
COMMENT ON COLUMN deposit_refund_requests.request_status IS '退还状态: pending(待处理), approved(已批准), rejected(已拒绝), completed(已完成)';

-- 5. 创建押金违规处理记录表
CREATE TABLE IF NOT EXISTS deposit_violation_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    violation_type VARCHAR(50) NOT NULL, -- 违规类型
    violation_description TEXT NOT NULL, -- 违规描述
    original_deposit_amount DECIMAL(10, 2) NOT NULL,
    platform_deduction_amount DECIMAL(10, 2) NOT NULL, -- 平台扣除金额(30%)
    victim_compensation_amount DECIMAL(10, 2) NOT NULL, -- 受害者补偿金额(70%)
    victim_user_ids UUID[], -- 受害者用户ID列表
    evidence_urls TEXT[], -- 证据URL列表
    processed_by UUID REFERENCES auth.users(id), -- 处理人
    processed_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE deposit_violation_records IS '押金违规处理记录表';

-- 6. 创建每日登录奖励记录表
CREATE TABLE IF NOT EXISTS daily_login_rewards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    merchant_id UUID REFERENCES merchants(id) ON DELETE SET NULL,
    is_deposit_merchant BOOLEAN DEFAULT FALSE,
    reward_points INTEGER NOT NULL, -- 奖励积分(押金商家50分, 普通用户可能不同)
    login_date DATE NOT NULL, -- 登录日期
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, login_date) -- 每天只能领取一次
);

COMMENT ON TABLE daily_login_rewards IS '每日登录奖励记录表';
CREATE INDEX IF NOT EXISTS idx_daily_login_rewards_user_date ON daily_login_rewards(user_id, login_date);

-- 7. 为押金商家相关表创建索引
CREATE INDEX IF NOT EXISTS idx_merchants_is_deposit_merchant ON merchants(is_deposit_merchant);
CREATE INDEX IF NOT EXISTS idx_merchants_deposit_status ON merchants(deposit_status);
CREATE INDEX IF NOT EXISTS idx_deposit_applications_status ON deposit_merchant_applications(application_status);
CREATE INDEX IF NOT EXISTS idx_deposit_applications_merchant ON deposit_merchant_applications(merchant_id);
CREATE INDEX IF NOT EXISTS idx_deposit_refund_status ON deposit_refund_requests(request_status);
CREATE INDEX IF NOT EXISTS idx_deposit_refund_merchant ON deposit_refund_requests(merchant_id);
CREATE INDEX IF NOT EXISTS idx_deposit_violation_merchant ON deposit_violation_records(merchant_id);

-- 8. 启用行级安全策略 (RLS)
ALTER TABLE deposit_merchant_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE deposit_refund_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE deposit_violation_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_login_rewards ENABLE ROW LEVEL SECURITY;

-- 9. 创建 RLS 策略 - 押金商家申请表
-- 用户可以查看自己的申请
CREATE POLICY "Users can view own deposit applications"
ON deposit_merchant_applications FOR SELECT
USING (auth.uid() = user_id);

-- 用户可以创建自己的申请
CREATE POLICY "Users can create own deposit applications"
ON deposit_merchant_applications FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- 用户可以更新自己待审核的申请
CREATE POLICY "Users can update own pending applications"
ON deposit_merchant_applications FOR UPDATE
USING (auth.uid() = user_id AND application_status = 'pending');

-- 10. 创建 RLS 策略 - 押金退还申请表
-- 用户可以查看自己的退还申请
CREATE POLICY "Users can view own refund requests"
ON deposit_refund_requests FOR SELECT
USING (auth.uid() = user_id);

-- 用户可以创建自己的退还申请
CREATE POLICY "Users can create own refund requests"
ON deposit_refund_requests FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- 11. 创建 RLS 策略 - 违规记录表
-- 用户可以查看与自己相关的违规记录
CREATE POLICY "Users can view own violation records"
ON deposit_violation_records FOR SELECT
USING (auth.uid() = user_id OR auth.uid() = ANY(victim_user_ids));

-- 12. 创建 RLS 策略 - 每日登录奖励表
-- 用户可以查看自己的登录奖励记录
CREATE POLICY "Users can view own login rewards"
ON daily_login_rewards FOR SELECT
USING (auth.uid() = user_id);

-- 用户可以创建自己的登录奖励记录
CREATE POLICY "Users can create own login rewards"
ON daily_login_rewards FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- 13. 创建自动更新 updated_at 的触发器函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 14. 为相关表添加 updated_at 自动更新触发器
CREATE TRIGGER update_deposit_applications_updated_at
    BEFORE UPDATE ON deposit_merchant_applications
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_deposit_refunds_updated_at
    BEFORE UPDATE ON deposit_refund_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 15. 插入一些测试数据（可选，用于测试）
-- 将第一个商家设置为押金商家用于测试
-- UPDATE merchants
-- SET is_deposit_merchant = TRUE,
--     deposit_amount = 500.00,
--     deposit_status = 'paid',
--     deposit_paid_at = NOW()
-- WHERE id = (SELECT id FROM merchants LIMIT 1);

-- =============================================
-- 脚本执行完成
-- =============================================

-- 验证脚本执行结果
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'merchants'
AND column_name IN (
    'is_deposit_merchant',
    'deposit_amount',
    'deposit_status',
    'deposit_paid_at',
    'last_daily_login_reward_at'
)
ORDER BY column_name;



-- =============================================
-- 文件: 029_fix_point_balance_simple.sql
-- =============================================

-- =============================================
-- 修复积分交易余额计算问题 (简化版)
-- 创建时间: 2025-10-30
-- 说明: 只修复 balance_after 计算逻辑,不改变函数行为
-- =============================================

-- 1. 删除之前错误的修复
DROP FUNCTION IF EXISTS public.record_point_transaction(UUID, INTEGER, TEXT, TEXT, UUID, UUID, JSONB);

-- 2. 重新创建函数,只记录交易,不更新积分
CREATE OR REPLACE FUNCTION public.record_point_transaction(
  p_user_id UUID,
  p_amount INTEGER,
  p_type TEXT,
  p_description TEXT,
  p_related_user_id UUID DEFAULT NULL,
  p_related_merchant_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_points INTEGER;
  v_transaction_id UUID;
BEGIN
  -- 获取当前积分
  SELECT points INTO v_current_points
  FROM public.profiles
  WHERE id = p_user_id;

  IF v_current_points IS NULL THEN
    RAISE EXCEPTION 'User profile not found';
  END IF;

  -- 插入交易记录
  -- 注意: balance_after 应该是当前积分,因为这个函数会在积分更新后被调用
  -- 所以 v_current_points 已经是更新后的值
  INSERT INTO public.point_transactions (
    user_id,
    amount,
    balance_after,
    type,
    description,
    related_user_id,
    related_merchant_id,
    metadata
  ) VALUES (
    p_user_id,
    p_amount,
    v_current_points, -- 使用当前积分(已经是更新后的值)
    p_type,
    p_description,
    p_related_user_id,
    p_related_merchant_id,
    p_metadata
  )
  RETURNING id INTO v_transaction_id;

  RETURN v_transaction_id;
END;
$$;

COMMENT ON FUNCTION public.record_point_transaction IS '记录积分变动(不更新积分,只记录交易)';

-- 3. 修复现有错误的 balance_after 数据
-- 按时间顺序重新计算每个用户的 balance_after

DO $$
DECLARE
  v_user_record RECORD;
  v_transaction_record RECORD;
  v_running_balance INTEGER;
BEGIN
  -- 遍历所有有交易记录的用户
  FOR v_user_record IN
    SELECT DISTINCT user_id
    FROM public.point_transactions
    ORDER BY user_id
  LOOP
    v_running_balance := 0;

    -- 按时间顺序遍历该用户的所有交易
    FOR v_transaction_record IN
      SELECT id, amount, created_at
      FROM public.point_transactions
      WHERE user_id = v_user_record.user_id
      ORDER BY created_at ASC, id ASC
    LOOP
      -- 累加积分
      v_running_balance := v_running_balance + v_transaction_record.amount;

      -- 更新 balance_after
      UPDATE public.point_transactions
      SET balance_after = v_running_balance
      WHERE id = v_transaction_record.id;
    END LOOP;

    -- 验证最终余额是否与 profiles 表一致
    DECLARE
      v_profile_points INTEGER;
    BEGIN
      SELECT points INTO v_profile_points
      FROM public.profiles
      WHERE id = v_user_record.user_id;

      IF v_profile_points IS NOT NULL AND v_profile_points != v_running_balance THEN
        RAISE NOTICE '警告: 用户 % 的积分不一致. Profiles 表: %, 计算结果: %',
          v_user_record.user_id, v_profile_points, v_running_balance;

        -- 更新 profiles 表使其与计算结果一致
        UPDATE public.profiles
        SET points = v_running_balance
        WHERE id = v_user_record.user_id;

        RAISE NOTICE '已将用户 % 的积分更新为正确值: %', v_user_record.user_id, v_running_balance;
      END IF;
    END;
  END LOOP;

  RAISE NOTICE '积分修复完成!';
END $$;

-- =============================================
-- 脚本执行完成
-- =============================================

-- 验证修复结果
SELECT
  u.id as user_id,
  u.email,
  p.points as profile_points,
  (SELECT balance_after FROM point_transactions WHERE user_id = u.id ORDER BY created_at DESC, id DESC LIMIT 1) as last_transaction_balance,
  CASE
    WHEN p.points = (SELECT balance_after FROM point_transactions WHERE user_id = u.id ORDER BY created_at DESC, id DESC LIMIT 1)
    THEN '✓ 一致'
    ELSE '✗ 不一致'
  END as status
FROM auth.users u
JOIN profiles p ON u.id = p.id
WHERE EXISTS (SELECT 1 FROM point_transactions WHERE user_id = u.id)
ORDER BY u.email;



-- =============================================
-- 文件: 030_emergency_fix_points.sql
-- =============================================

-- =============================================
-- 紧急回滚和修复积分
-- 创建时间: 2025-10-30
-- 说明: 回滚错误的修复,重建正确的交易记录
-- =============================================

-- 1. 先查看当前所有用户的积分情况
SELECT
  u.id,
  u.email,
  p.points as current_points,
  COALESCE(SUM(pt.amount), 0) as sum_of_transactions,
  p.points - COALESCE(SUM(pt.amount), 0) as difference
FROM auth.users u
LEFT JOIN profiles p ON u.id = p.id
LEFT JOIN point_transactions pt ON u.id = pt.user_id
GROUP BY u.id, u.email, p.points
HAVING p.points - COALESCE(SUM(pt.amount), 0) != 0 OR p.points < 0
ORDER BY p.points;

-- 2. 对于每个积分异常的用户,创建系统调整记录来补齐差额
DO $$
DECLARE
  v_user_record RECORD;
  v_transaction_sum INTEGER;
  v_difference INTEGER;
  v_correct_points INTEGER;
BEGIN
  FOR v_user_record IN
    SELECT
      u.id as user_id,
      u.email,
      p.points as current_points
    FROM auth.users u
    JOIN profiles p ON u.id = p.id
  LOOP
    -- 计算该用户所有交易记录的总和
    SELECT COALESCE(SUM(amount), 0) INTO v_transaction_sum
    FROM point_transactions
    WHERE user_id = v_user_record.user_id;

    v_difference := v_user_record.current_points - v_transaction_sum;

    -- 如果当前积分是负数,说明被错误修复了
    IF v_user_record.current_points < 0 THEN
      -- 找出最后一条正常的交易记录的 balance_after
      SELECT balance_after INTO v_correct_points
      FROM point_transactions
      WHERE user_id = v_user_record.user_id
        AND balance_after > 0
      ORDER BY created_at DESC, id DESC
      LIMIT 1;

      -- 如果找不到正常记录,使用0作为基础
      IF v_correct_points IS NULL THEN
        v_correct_points := 0;
      END IF;

      -- 计算需要恢复多少积分
      v_difference := v_correct_points - v_transaction_sum;

      IF v_difference != 0 THEN
        RAISE NOTICE '用户 % (%) 需要系统调整: 交易总和=%, 应有积分=%, 差额=%',
          v_user_record.email, v_user_record.user_id, v_transaction_sum, v_correct_points, v_difference;

        -- 创建系统调整记录
        INSERT INTO point_transactions (
          user_id,
          amount,
          balance_after,
          type,
          description,
          metadata
        ) VALUES (
          v_user_record.user_id,
          v_difference,
          v_correct_points,
          'system_adjustment',
          '系统积分调整 (修复错误)',
          jsonb_build_object(
            'reason', 'fix_balance_error',
            'previous_balance', v_user_record.current_points,
            'transaction_sum', v_transaction_sum
          )
        );

        -- 更新 profiles 表
        UPDATE profiles
        SET points = v_correct_points
        WHERE id = v_user_record.user_id;

        RAISE NOTICE '已修复用户 % 的积分: % -> %',
          v_user_record.email, v_user_record.current_points, v_correct_points;
      END IF;

    -- 如果只是交易记录和 profiles 不一致(但不是负数)
    ELSIF v_difference != 0 THEN
      RAISE NOTICE '用户 % (%) 交易记录与积分不一致: 当前积分=%, 交易总和=%, 差额=%',
        v_user_record.email, v_user_record.user_id, v_user_record.current_points, v_transaction_sum, v_difference;

      -- 创建系统调整记录来补齐差额
      INSERT INTO point_transactions (
        user_id,
        amount,
        balance_after,
        type,
        description,
        metadata
      ) VALUES (
        v_user_record.user_id,
        v_difference,
        v_user_record.current_points,
        'system_adjustment',
        '系统积分调整 (补充缺失记录)',
        jsonb_build_object(
          'reason', 'fill_missing_transaction',
          'transaction_sum', v_transaction_sum
        )
      );

      RAISE NOTICE '已为用户 % 补充交易记录,差额: %', v_user_record.email, v_difference;
    END IF;
  END LOOP;

  RAISE NOTICE '积分修复完成!';
END $$;

-- 3. 重新计算所有用户的 balance_after
DO $$
DECLARE
  v_user_record RECORD;
  v_transaction_record RECORD;
  v_running_balance INTEGER;
BEGIN
  FOR v_user_record IN
    SELECT DISTINCT user_id
    FROM public.point_transactions
    ORDER BY user_id
  LOOP
    v_running_balance := 0;

    FOR v_transaction_record IN
      SELECT id, amount, created_at
      FROM public.point_transactions
      WHERE user_id = v_user_record.user_id
      ORDER BY created_at ASC, id ASC
    LOOP
      v_running_balance := v_running_balance + v_transaction_record.amount;

      UPDATE public.point_transactions
      SET balance_after = v_running_balance
      WHERE id = v_transaction_record.id;
    END LOOP;
  END LOOP;
END $$;

-- =============================================
-- 验证修复结果
-- =============================================

SELECT
  u.email,
  p.points as 当前积分,
  (SELECT balance_after FROM point_transactions WHERE user_id = u.id ORDER BY created_at DESC, id DESC LIMIT 1) as 最后交易余额,
  (SELECT SUM(amount) FROM point_transactions WHERE user_id = u.id) as 交易总和,
  CASE
    WHEN p.points = (SELECT balance_after FROM point_transactions WHERE user_id = u.id ORDER BY created_at DESC, id DESC LIMIT 1)
    THEN '✓ 正常'
    ELSE '✗ 异常'
  END as 状态
FROM auth.users u
JOIN profiles p ON u.id = p.id
WHERE EXISTS (SELECT 1 FROM point_transactions WHERE user_id = u.id)
ORDER BY p.points DESC;



-- =============================================
-- 文件: 032.4_create_deposit_refund_safe.sql
-- =============================================

-- =============================================
-- 安全执行：创建押金退还申请表（跳过已存在的对象）
-- =============================================

-- 1. 先删除可能存在的旧索引
DROP INDEX IF EXISTS public.idx_deposit_refund_merchant;
DROP INDEX IF EXISTS public.idx_deposit_refund_user;
DROP INDEX IF EXISTS public.idx_deposit_refund_status;
DROP INDEX IF EXISTS public.idx_deposit_refund_created;

-- 2. 创建表（如果不存在）
CREATE TABLE IF NOT EXISTS public.deposit_refund_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 关联信息
  merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- 押金信息
  deposit_amount DECIMAL(10, 2) NOT NULL,
  deposit_paid_at TIMESTAMP WITH TIME ZONE NOT NULL,
  refund_amount DECIMAL(10, 2) NOT NULL,
  fee_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
  fee_rate DECIMAL(5, 2) NOT NULL,

  -- 申请信息
  application_status TEXT NOT NULL DEFAULT 'pending',
  reason TEXT,

  -- 收款信息
  wallet_address TEXT NOT NULL,
  wallet_network TEXT NOT NULL,

  -- 审核信息
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  review_note TEXT,
  rejected_reason TEXT,

  -- 处理信息
  processed_by UUID REFERENCES auth.users(id),
  processed_at TIMESTAMP WITH TIME ZONE,
  transaction_hash TEXT,
  transaction_proof_url TEXT,

  -- 完成信息
  completed_at TIMESTAMP WITH TIME ZONE,
  completion_note TEXT,

  -- 时间戳
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  -- 约束
  CONSTRAINT valid_status CHECK (application_status IN ('pending', 'approved', 'processing', 'completed', 'rejected')),
  CONSTRAINT valid_amounts CHECK (deposit_amount > 0 AND refund_amount >= 0 AND fee_amount >= 0),
  CONSTRAINT valid_fee_rate CHECK (fee_rate >= 0 AND fee_rate <= 100),
  CONSTRAINT valid_wallet_network CHECK (wallet_network IN ('TRC20', 'ERC20', 'BEP20'))
);

-- 3. 创建索引（删除旧的后重新创建）
CREATE INDEX idx_deposit_refund_merchant ON public.deposit_refund_applications(merchant_id);
CREATE INDEX idx_deposit_refund_user ON public.deposit_refund_applications(user_id);
CREATE INDEX idx_deposit_refund_status ON public.deposit_refund_applications(application_status);
CREATE INDEX idx_deposit_refund_created ON public.deposit_refund_applications(created_at DESC);

-- 4. 创建或替换更新时间触发器函数
CREATE OR REPLACE FUNCTION update_deposit_refund_applications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. 删除旧触发器（如果存在）并创建新的
DROP TRIGGER IF EXISTS trigger_update_deposit_refund_applications_updated_at ON public.deposit_refund_applications;

CREATE TRIGGER trigger_update_deposit_refund_applications_updated_at
  BEFORE UPDATE ON public.deposit_refund_applications
  FOR EACH ROW
  EXECUTE FUNCTION update_deposit_refund_applications_updated_at();

-- 6. 添加表注释
COMMENT ON TABLE public.deposit_refund_applications IS '押金退还申请表';
COMMENT ON COLUMN public.deposit_refund_applications.merchant_id IS '商家ID';
COMMENT ON COLUMN public.deposit_refund_applications.user_id IS '用户ID';
COMMENT ON COLUMN public.deposit_refund_applications.deposit_amount IS '原始押金金额';
COMMENT ON COLUMN public.deposit_refund_applications.deposit_paid_at IS '押金缴纳时间';
COMMENT ON COLUMN public.deposit_refund_applications.refund_amount IS '实际退还金额（扣除手续费后）';
COMMENT ON COLUMN public.deposit_refund_applications.fee_amount IS '手续费金额';
COMMENT ON COLUMN public.deposit_refund_applications.fee_rate IS '手续费率（百分比）';
COMMENT ON COLUMN public.deposit_refund_applications.application_status IS '申请状态';
COMMENT ON COLUMN public.deposit_refund_applications.reason IS '退还原因';
COMMENT ON COLUMN public.deposit_refund_applications.wallet_address IS 'USDT钱包地址';
COMMENT ON COLUMN public.deposit_refund_applications.wallet_network IS '网络类型';
COMMENT ON COLUMN public.deposit_refund_applications.transaction_hash IS '交易哈希';

-- 7. 启用 RLS
ALTER TABLE public.deposit_refund_applications ENABLE ROW LEVEL SECURITY;

-- 8. 删除旧策略（如果存在）
DROP POLICY IF EXISTS "商家可以查看自己的退还申请" ON public.deposit_refund_applications;
DROP POLICY IF EXISTS "商家可以创建自己的退还申请" ON public.deposit_refund_applications;
DROP POLICY IF EXISTS "商家可以更新pending状态的申请" ON public.deposit_refund_applications;
DROP POLICY IF EXISTS "管理员可以查看所有退还申请" ON public.deposit_refund_applications;
DROP POLICY IF EXISTS "管理员可以更新所有退还申请" ON public.deposit_refund_applications;

-- 9. 创建 RLS 策略
CREATE POLICY "商家可以查看自己的退还申请"
  ON public.deposit_refund_applications
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "商家可以创建自己的退还申请"
  ON public.deposit_refund_applications
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "商家可以更新pending状态的申请"
  ON public.deposit_refund_applications
  FOR UPDATE
  USING (auth.uid() = user_id AND application_status = 'pending');

CREATE POLICY "管理员可以查看所有退还申请"
  ON public.deposit_refund_applications
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "管理员可以更新所有退还申请"
  ON public.deposit_refund_applications
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- 10. 更新 merchants 表，添加退还相关字段
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'merchants'
    AND column_name = 'deposit_refund_requested_at'
  ) THEN
    ALTER TABLE public.merchants
    ADD COLUMN deposit_refund_requested_at TIMESTAMP WITH TIME ZONE;
    COMMENT ON COLUMN public.merchants.deposit_refund_requested_at IS '最后一次申请退还时间';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'merchants'
    AND column_name = 'deposit_refund_completed_at'
  ) THEN
    ALTER TABLE public.merchants
    ADD COLUMN deposit_refund_completed_at TIMESTAMP WITH TIME ZONE;
    COMMENT ON COLUMN public.merchants.deposit_refund_completed_at IS '退还完成时间';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'merchants'
    AND column_name = 'deposit_refund_status'
  ) THEN
    ALTER TABLE public.merchants
    ADD COLUMN deposit_refund_status TEXT;
    COMMENT ON COLUMN public.merchants.deposit_refund_status IS '退还状态（none/pending/completed）';
  END IF;
END $$;

-- =============================================
-- 脚本执行完成
-- =============================================

-- 验证表创建
SELECT
  'deposit_refund_applications table created/verified' as status,
  COUNT(*) as column_count
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'deposit_refund_applications';



-- =============================================
-- 文件: 033_update_reports_table.sql
-- =============================================

-- 更新 reports 表结构
-- 从旧版本迁移到新版本（添加 evidence_urls 字段和重命名字段）

-- 1. 添加新字段
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS evidence_urls TEXT[];
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS report_type VARCHAR(50);
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS report_reason TEXT;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS admin_id UUID REFERENCES auth.users(id);
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS admin_note TEXT;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ;

-- 2. 迁移旧数据到新字段
UPDATE public.reports
SET report_type = reason
WHERE report_type IS NULL AND reason IS NOT NULL;

UPDATE public.reports
SET report_reason = details
WHERE report_reason IS NULL AND details IS NOT NULL;

-- 3. 删除旧字段（如果确认数据已迁移）
-- 注意：请先备份数据，确认迁移成功后再执行删除操作
-- ALTER TABLE public.reports DROP COLUMN IF EXISTS reason;
-- ALTER TABLE public.reports DROP COLUMN IF EXISTS details;
-- ALTER TABLE public.reports DROP COLUMN IF EXISTS admin_notes;

-- 4. 设置新字段为 NOT NULL（在确保所有数据已迁移后）
-- ALTER TABLE public.reports ALTER COLUMN report_type SET NOT NULL;
-- ALTER TABLE public.reports ALTER COLUMN report_reason SET NOT NULL;

-- 5. 创建或更新索引
CREATE INDEX IF NOT EXISTS idx_reports_reporter_id ON public.reports(reporter_id);
CREATE INDEX IF NOT EXISTS idx_reports_merchant_id ON public.reports(merchant_id);
CREATE INDEX IF NOT EXISTS idx_reports_status ON public.reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON public.reports(created_at DESC);

-- 6. 更新触发器（如果不存在）
CREATE OR REPLACE FUNCTION update_reports_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_reports_updated_at ON public.reports;
CREATE TRIGGER trigger_reports_updated_at
  BEFORE UPDATE ON public.reports
  FOR EACH ROW
  EXECUTE FUNCTION update_reports_updated_at();

-- 7. 验证表结构
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'reports' AND table_schema = 'public'
ORDER BY ordinal_position;



-- =============================================
-- 文件: 034_add_report_count_to_profiles.sql
-- =============================================

-- 在 profiles 表添加举报次数统计字段
-- 用于记录用户累计举报次数

-- 1. 添加 report_count 字段
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS report_count INTEGER DEFAULT 0 NOT NULL;

-- 2. 创建索引以提升查询性能
CREATE INDEX IF NOT EXISTS idx_profiles_report_count ON public.profiles(report_count DESC);

-- 3. 初始化现有用户的举报次数
UPDATE public.profiles p
SET report_count = (
  SELECT COUNT(*)
  FROM public.reports r
  WHERE r.reporter_id = p.id
)
WHERE EXISTS (
  SELECT 1 FROM public.reports WHERE reporter_id = p.id
);

-- 4. 创建触发器函数 - 自动增加举报次数
CREATE OR REPLACE FUNCTION increment_user_report_count()
RETURNS TRIGGER AS $$
BEGIN
  -- 当新增举报时，增加举报者的举报次数
  UPDATE public.profiles
  SET report_count = report_count + 1
  WHERE id = NEW.reporter_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. 创建触发器 - 新增举报时自动执行
DROP TRIGGER IF EXISTS trigger_increment_report_count ON public.reports;
CREATE TRIGGER trigger_increment_report_count
  AFTER INSERT ON public.reports
  FOR EACH ROW
  EXECUTE FUNCTION increment_user_report_count();

-- 6. 创建触发器函数 - 删除举报时减少次数
CREATE OR REPLACE FUNCTION decrement_user_report_count()
RETURNS TRIGGER AS $$
BEGIN
  -- 当删除举报时，减少举报者的举报次数
  UPDATE public.profiles
  SET report_count = GREATEST(report_count - 1, 0)  -- 确保不会小于0
  WHERE id = OLD.reporter_id;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- 7. 创建触发器 - 删除举报时自动执行
DROP TRIGGER IF EXISTS trigger_decrement_report_count ON public.reports;
CREATE TRIGGER trigger_decrement_report_count
  AFTER DELETE ON public.reports
  FOR EACH ROW
  EXECUTE FUNCTION decrement_user_report_count();

-- 8. 验证结果
SELECT
  p.id,
  p.username,
  p.report_count,
  (SELECT COUNT(*) FROM public.reports WHERE reporter_id = p.id) as actual_count
FROM public.profiles p
WHERE p.report_count > 0
ORDER BY p.report_count DESC
LIMIT 10;

-- 9. 显示统计信息
SELECT
  COUNT(*) as total_users,
  COUNT(CASE WHEN report_count > 0 THEN 1 END) as users_with_reports,
  AVG(report_count) as avg_reports_per_user,
  MAX(report_count) as max_reports
FROM public.profiles;



-- =============================================
-- 文件: 035_remove_old_fields_constraints.sql
-- =============================================

-- 移除 reports 表旧字段的 NOT NULL 约束
-- 使旧字段变为可选，只使用新字段

-- 1. 移除旧字段的 NOT NULL 约束
ALTER TABLE public.reports ALTER COLUMN reason DROP NOT NULL;
ALTER TABLE public.reports ALTER COLUMN details DROP NOT NULL;

-- 2. 验证约束已移除
SELECT
  column_name,
  is_nullable,
  data_type
FROM information_schema.columns
WHERE table_name = 'reports'
  AND table_schema = 'public'
  AND column_name IN ('reason', 'details', 'report_type', 'report_reason')
ORDER BY column_name;

-- 3. 显示说明
SELECT '旧字段 reason 和 details 的 NOT NULL 约束已移除' as status;
SELECT '现在可以只使用新字段 report_type 和 report_reason' as info;



-- =============================================
-- 文件: 036_add_merchant_credit_system.sql
-- =============================================

-- 商家信用积分系统
-- 添加信用分数字段和积分变动记录表

-- 1. 在 merchants 表添加 credit_score 字段
ALTER TABLE public.merchants
ADD COLUMN IF NOT EXISTS credit_score INTEGER DEFAULT 100 NOT NULL;

-- 添加约束：信用分数不能为负数
ALTER TABLE public.merchants
ADD CONSTRAINT credit_score_non_negative CHECK (credit_score >= 0);

-- 创建索引以提升查询性能
CREATE INDEX IF NOT EXISTS idx_merchants_credit_score ON public.merchants(credit_score DESC);

-- 2. 创建积分变动记录表
CREATE TABLE IF NOT EXISTS public.credit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  admin_id UUID NOT NULL REFERENCES auth.users(id),
  report_id UUID REFERENCES public.reports(id) ON DELETE SET NULL,
  change_amount INTEGER NOT NULL, -- 变动积分（负数为扣分）
  previous_score INTEGER NOT NULL, -- 变动前的分数
  new_score INTEGER NOT NULL, -- 变动后的分数
  reason TEXT NOT NULL, -- 变动原因
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_credit_logs_merchant_id ON public.credit_logs(merchant_id);
CREATE INDEX IF NOT EXISTS idx_credit_logs_created_at ON public.credit_logs(created_at DESC);

-- 3. 初始化现有商家的信用分数（如果之前没有设置）
UPDATE public.merchants
SET credit_score = 100
WHERE credit_score IS NULL;

-- 4. 创建触发器函数 - 当信用分数降到0时自动下架商家
CREATE OR REPLACE FUNCTION auto_deactivate_merchant_on_low_credit()
RETURNS TRIGGER AS $$
BEGIN
  -- 如果信用分数降到0或以下，自动下架商家
  IF NEW.credit_score <= 0 AND OLD.credit_score > 0 THEN
    NEW.is_active = FALSE;

    -- 发送通知给商家
    INSERT INTO public.user_notifications (user_id, type, title, content)
    VALUES (
      NEW.user_id,
      'merchant_deactivated',
      '商家已被自动下架',
      '由于信用分数降至0分，您的商家【' || NEW.name || '】已被系统自动下架。如有疑问请联系客服。'
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. 创建触发器
DROP TRIGGER IF EXISTS trigger_auto_deactivate_merchant ON public.merchants;
CREATE TRIGGER trigger_auto_deactivate_merchant
  BEFORE UPDATE OF credit_score ON public.merchants
  FOR EACH ROW
  WHEN (NEW.credit_score IS DISTINCT FROM OLD.credit_score)
  EXECUTE FUNCTION auto_deactivate_merchant_on_low_credit();

-- 6. 设置 RLS 策略

-- credit_logs 表 RLS
ALTER TABLE public.credit_logs ENABLE ROW LEVEL SECURITY;

-- 管理员可以查看所有记录
CREATE POLICY "管理员可以查看所有积分记录" ON public.credit_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- 管理员可以插入记录
CREATE POLICY "管理员可以创建积分记录" ON public.credit_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- 商家可以查看自己的积分记录
CREATE POLICY "商家可以查看自己的积分记录" ON public.credit_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.merchants m
      WHERE m.id = credit_logs.merchant_id AND m.user_id = auth.uid()
    )
  );

-- 所有人都可以看到商家的信用分数（通过 merchants 表）
-- merchants 表已有 RLS，不需要额外设置

-- 7. 验证结果
SELECT
  'credit_score 字段已添加' as status,
  COUNT(*) as merchant_count,
  AVG(credit_score) as avg_credit_score,
  MIN(credit_score) as min_credit_score,
  MAX(credit_score) as max_credit_score
FROM public.merchants;

SELECT
  'credit_logs 表已创建' as status,
  COUNT(*) as log_count
FROM public.credit_logs;

-- 8. 显示表结构
SELECT
  column_name,
  data_type,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'merchants'
  AND table_schema = 'public'
  AND column_name IN ('credit_score', 'is_active')
ORDER BY column_name;

SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'credit_logs'
  AND table_schema = 'public'
ORDER BY ordinal_position;



-- =============================================
-- 文件: 037_fix_reports_rls_for_credit_system.sql
-- =============================================

-- 修复 reports 表的 RLS 策略，允许管理员更新举报记录
-- 问题：之前的策略可能阻止了通过 service role 更新

-- 1. 删除可能冲突的旧策略
DROP POLICY IF EXISTS "管理员可以更新举报" ON public.reports;
DROP POLICY IF EXISTS "Admins can update reports" ON public.reports;

-- 2. 重新创建管理员更新策略
CREATE POLICY "管理员可以更新举报" ON public.reports
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- 3. 确保 service_role 可以绕过 RLS（应该默认可以，但确认一下）
-- Service role 默认绕过 RLS，无需额外设置

-- 4. 检查 merchants 表的 RLS 更新策略
DROP POLICY IF EXISTS "管理员可以更新商家" ON public.merchants;

CREATE POLICY "管理员可以更新商家" ON public.merchants
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- 5. 验证策略
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE tablename IN ('reports', 'merchants')
  AND schemaname = 'public'
ORDER BY tablename, policyname;

SELECT '✅ RLS 策略已修复' as status;



-- =============================================
-- 文件: 038_add_transaction_hash_to_deposit_applications.sql
-- =============================================

-- 添加交易哈希字段到押金商家申请表
-- 用于记录用户支付押金时的区块链交易哈希/交易ID

ALTER TABLE public.deposit_merchant_applications
ADD COLUMN IF NOT EXISTS transaction_hash TEXT;

COMMENT ON COLUMN public.deposit_merchant_applications.transaction_hash IS '交易哈希/交易ID（区块链交易凭证）';




-- =============================================
-- 文件: 032.8_create_partners_table.sql
-- =============================================

-- 创建合作伙伴表
CREATE TABLE IF NOT EXISTS partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  logo_url TEXT,
  website_url TEXT NOT NULL,
  description TEXT,
  status VARCHAR(50) DEFAULT 'pending',
  -- 状态: pending(待审核), approved(已审核), rejected(已拒绝)
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  approved_at TIMESTAMP WITH TIME ZONE,
  approved_by UUID REFERENCES auth.users(id),
  rejection_reason TEXT,
  sort_order INTEGER DEFAULT 0
  -- 排序顺序,数字越小越靠前
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_partners_status ON partners (status);

CREATE INDEX IF NOT EXISTS idx_partners_created_at ON partners (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_partners_sort_order ON partners (sort_order ASC, created_at DESC);

-- 启用 RLS
ALTER TABLE partners ENABLE ROW LEVEL SECURITY;

-- RLS 策略:所有人可以查看已审核的合作伙伴
CREATE POLICY "Anyone can view approved partners" ON partners FOR
SELECT
  USING (status = 'approved');

-- RLS 策略:认证用户可以创建合作伙伴申请
CREATE POLICY "Authenticated users can create partner applications" ON partners FOR INSERT TO authenticated
WITH
  CHECK (auth.uid () = created_by);

-- RLS 策略:申请人可以查看自己的申请
CREATE POLICY "Users can view their own partner applications" ON partners FOR
SELECT
  TO authenticated USING (auth.uid () = created_by);

-- RLS 策略:管理员可以查看所有合作伙伴
CREATE POLICY "Admins can view all partners" ON partners FOR
SELECT
  TO authenticated USING (
    EXISTS (
      SELECT
        1
      FROM
        profiles
      WHERE
        profiles.id = auth.uid ()
        AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- RLS 策略:管理员可以更新合作伙伴状态
CREATE POLICY "Admins can update partners" ON partners FOR
UPDATE TO authenticated USING (
  EXISTS (
    SELECT
      1
    FROM
      profiles
    WHERE
      profiles.id = auth.uid ()
      AND profiles.role IN ('admin', 'super_admin')
  )
)
WITH
  CHECK (
    EXISTS (
      SELECT
        1
      FROM
        profiles
      WHERE
        profiles.id = auth.uid ()
        AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- 创建更新时间戳的触发器函数(如果不存在)
CREATE OR REPLACE FUNCTION update_updated_at_column () RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 为 partners 表添加触发器
DROP TRIGGER IF EXISTS update_partners_updated_at ON partners;

CREATE TRIGGER update_partners_updated_at BEFORE
UPDATE ON partners FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column ();

-- 添加注释
COMMENT ON TABLE partners IS '合作伙伴表';

COMMENT ON COLUMN partners.id IS '主键ID';

COMMENT ON COLUMN partners.name IS '合作伙伴名称';

COMMENT ON COLUMN partners.logo_url IS 'Logo图片URL';

COMMENT ON COLUMN partners.website_url IS '官网链接';

COMMENT ON COLUMN partners.description IS '合作伙伴描述';

COMMENT ON COLUMN partners.status IS '状态: pending(待审核), approved(已审核), rejected(已拒绝)';

COMMENT ON COLUMN partners.created_by IS '申请人用户ID';

COMMENT ON COLUMN partners.approved_by IS '审核人用户ID';

COMMENT ON COLUMN partners.rejection_reason IS '拒绝原因';

COMMENT ON COLUMN partners.sort_order IS '排序顺序';



-- =============================================
-- 文件: 039_add_partner_subscription_fields.sql
-- =============================================

-- 添加合作伙伴订阅相关字段
-- 用途: 添加有效期、年费、支付凭证等字段以支持合作伙伴付费订阅功能

-- 添加新字段
ALTER TABLE partners ADD COLUMN IF NOT EXISTS duration_years INTEGER DEFAULT 1;
ALTER TABLE partners ADD COLUMN IF NOT EXISTS annual_fee DECIMAL(10, 2) DEFAULT 100.00;
ALTER TABLE partners ADD COLUMN IF NOT EXISTS total_amount DECIMAL(10, 2);
ALTER TABLE partners ADD COLUMN IF NOT EXISTS payment_proof_url TEXT;
ALTER TABLE partners ADD COLUMN IF NOT EXISTS transaction_hash TEXT;
ALTER TABLE partners ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE;

-- 添加字段注释
COMMENT ON COLUMN partners.duration_years IS '订阅时长（年），最低1年';
COMMENT ON COLUMN partners.annual_fee IS '年费（USDT），默认100';
COMMENT ON COLUMN partners.total_amount IS '总金额（USDT），等于 annual_fee * duration_years';
COMMENT ON COLUMN partners.payment_proof_url IS '支付凭证图片URL';
COMMENT ON COLUMN partners.transaction_hash IS '区块链交易哈希或支付平台交易ID';
COMMENT ON COLUMN partners.expires_at IS '到期时间，审核通过后开始计算';

-- 更新现有数据的默认值（如果有数据的话）
UPDATE partners
SET
  duration_years = 1,
  annual_fee = 100.00,
  total_amount = 100.00
WHERE duration_years IS NULL;

-- 删除旧约束（如果存在）
ALTER TABLE partners DROP CONSTRAINT IF EXISTS check_duration_years;
ALTER TABLE partners DROP CONSTRAINT IF EXISTS check_annual_fee;
ALTER TABLE partners DROP CONSTRAINT IF EXISTS check_total_amount;

-- 添加约束检查
ALTER TABLE partners ADD CONSTRAINT check_duration_years CHECK (duration_years >= 1);
ALTER TABLE partners ADD CONSTRAINT check_annual_fee CHECK (annual_fee >= 100.00);
ALTER TABLE partners ADD CONSTRAINT check_total_amount CHECK (total_amount >= 100.00);



-- =============================================
-- 文件: 040_setup_partner_expiry_cron.sql
-- =============================================

-- ====================================================================
-- 配置合作伙伴到期提醒定时任务
-- 用途: 使用 Supabase pg_cron 每天检查即将到期的合作伙伴并发送通知
-- 执行频率: 每天凌晨 0:00 (UTC)
-- ====================================================================

-- 1. 启用 pg_cron 扩展（如果还没启用）
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2. 启用 http 扩展（用于发送 HTTP 请求）
CREATE EXTENSION IF NOT EXISTS http;

-- 3. 删除可能存在的旧定时任务（避免重复）
SELECT cron.unschedule('check-expiring-partners-daily')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'check-expiring-partners-daily'
);

-- 4. 创建定时任务：每天凌晨 0:00 检查即将到期的合作伙伴
-- 注意: 请将 'https://your-domain.com' 替换为你的实际域名
SELECT cron.schedule(
  'check-expiring-partners-daily',  -- 任务名称
  '0 0 * * *',                      -- Cron 表达式: 每天凌晨 0:00 (UTC)
  $$
  SELECT
    net.http_post(
      url := 'https://your-domain.com/api/cron/check-expiring-partners',
      headers := '{"Content-Type": "application/json"}'::jsonb,
      timeout_milliseconds := 30000
    ) AS request_id;
  $$
);

-- ====================================================================
-- 如果需要添加 Authorization 认证（推荐用于生产环境）
-- 取消下面的注释，并替换 'your-secret-key' 为你的实际密钥
-- ====================================================================

/*
-- 删除上面创建的任务
SELECT cron.unschedule('check-expiring-partners-daily');

-- 重新创建带认证的任务
SELECT cron.schedule(
  'check-expiring-partners-daily',
  '0 0 * * *',
  $$
  SELECT
    net.http_post(
      url := 'https://your-domain.com/api/cron/check-expiring-partners',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer your-secret-key'
      ),
      timeout_milliseconds := 30000
    ) AS request_id;
  $$
);
*/

-- ====================================================================
-- 管理命令（仅供参考，不会自动执行）
-- ====================================================================

-- 查看所有定时任务
-- SELECT * FROM cron.job;

-- 查看定时任务执行历史（最近10次）
-- SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;

-- 删除定时任务
-- SELECT cron.unschedule('check-expiring-partners-daily');

-- 手动触发测试（不会实际执行，仅用于验证 SQL 语法）
-- SELECT
--   net.http_post(
--     url := 'https://your-domain.com/api/cron/check-expiring-partners',
--     headers := '{"Content-Type": "application/json"}'::jsonb
--   ) AS request_id;

-- ====================================================================
-- 执行完成后的验证步骤
-- ====================================================================

-- 1. 验证任务是否创建成功
SELECT
  jobid,
  jobname,
  schedule,
  command,
  active
FROM cron.job
WHERE jobname = 'check-expiring-partners-daily';

-- 2. 等待下次执行后查看执行结果
-- SELECT
--   jobid,
--   runid,
--   job_pid,
--   database,
--   username,
--   command,
--   status,
--   return_message,
--   start_time,
--   end_time
-- FROM cron.job_run_details
-- WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'check-expiring-partners-daily')
-- ORDER BY start_time DESC
-- LIMIT 5;



-- =============================================
-- 文件: 041_update_existing_partners_expiry.sql
-- =============================================

-- ====================================================================
-- 为已通过审核但没有到期时间的合作伙伴设置到期时间
-- 用途: 补充旧数据的到期时间字段
-- 执行时机: 在 039 脚本之后执行
-- ====================================================================

-- 为所有已通过但没有到期时间的合作伙伴设置到期时间
-- 计算方式: 审核通过时间 + duration_years 年
UPDATE partners
SET expires_at = (approved_at::timestamp + (COALESCE(duration_years, 1) || ' years')::interval)
WHERE status = 'approved'
  AND expires_at IS NULL
  AND approved_at IS NOT NULL;

-- 验证更新结果
SELECT
  id,
  name,
  status,
  duration_years,
  approved_at,
  expires_at,
  CASE
    WHEN expires_at IS NOT NULL THEN '已设置'
    ELSE '未设置'
  END as expiry_status
FROM partners
WHERE status = 'approved'
ORDER BY approved_at DESC;



-- =============================================
-- 文件: 042_add_partner_notes.sql
-- =============================================

-- ====================================================================
-- 为合作伙伴表添加备注字段
-- 用途: 管理员可以为合作伙伴添加内部备注
-- ====================================================================

-- 添加备注字段
ALTER TABLE partners ADD COLUMN IF NOT EXISTS admin_notes TEXT;

-- 添加字段注释
COMMENT ON COLUMN partners.admin_notes IS '管理员备注（仅管理员可见）';

-- 验证字段是否添加成功
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'partners' AND column_name = 'admin_notes';



-- =============================================
-- 文件: 043_fix_deposit_refund_rls.sql
-- =============================================

-- 为 deposit_refund_applications 表设置 RLS 策略
-- 让管理员可以查看所有退还申请,普通用户只能查看自己的申请

-- 首先确保 RLS 已启用
ALTER TABLE deposit_refund_applications ENABLE ROW LEVEL SECURITY;

-- 删除可能存在的旧策略
DROP POLICY IF EXISTS "Users can view own refund applications" ON deposit_refund_applications;
DROP POLICY IF EXISTS "Admins can view all refund applications" ON deposit_refund_applications;
DROP POLICY IF EXISTS "Users can insert own refund applications" ON deposit_refund_applications;
DROP POLICY IF EXISTS "Admins can update refund applications" ON deposit_refund_applications;

-- 1. 用户可以查看自己的退还申请
CREATE POLICY "Users can view own refund applications"
ON deposit_refund_applications
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- 2. 管理员可以查看所有退还申请
CREATE POLICY "Admins can view all refund applications"
ON deposit_refund_applications
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('admin', 'super_admin')
  )
);

-- 3. 用户可以插入自己的退还申请
CREATE POLICY "Users can insert own refund applications"
ON deposit_refund_applications
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- 4. 管理员可以更新任何退还申请(审核)
CREATE POLICY "Admins can update refund applications"
ON deposit_refund_applications
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('admin', 'super_admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('admin', 'super_admin')
  )
);

-- 验证策略
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'deposit_refund_applications';



-- =============================================
-- 文件: 044_create_announcements_table.sql
-- =============================================

-- 创建公告表
CREATE TABLE IF NOT EXISTS public.announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info' CHECK (type IN ('info', 'warning', 'success', 'error', 'update')),
  priority INTEGER NOT NULL DEFAULT 0 CHECK (priority >= 0 AND priority <= 10),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
  target_audience TEXT NOT NULL DEFAULT 'all' CHECK (target_audience IN ('all', 'users', 'merchants', 'partners')),
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  click_count INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_announcements_is_active ON public.announcements(is_active);
CREATE INDEX IF NOT EXISTS idx_announcements_is_pinned ON public.announcements(is_pinned);
CREATE INDEX IF NOT EXISTS idx_announcements_type ON public.announcements(type);
CREATE INDEX IF NOT EXISTS idx_announcements_target_audience ON public.announcements(target_audience);
CREATE INDEX IF NOT EXISTS idx_announcements_priority ON public.announcements(priority DESC);
CREATE INDEX IF NOT EXISTS idx_announcements_created_at ON public.announcements(created_at DESC);

-- 创建触发器以自动更新 updated_at
CREATE OR REPLACE FUNCTION update_announcements_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_announcements_updated_at ON public.announcements;
CREATE TRIGGER trigger_update_announcements_updated_at
  BEFORE UPDATE ON public.announcements
  FOR EACH ROW
  EXECUTE FUNCTION update_announcements_updated_at();

-- 启用 RLS
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- RLS 策略：所有人都可以查看激活的公告
CREATE POLICY "所有人可以查看激活的公告"
  ON public.announcements
  FOR SELECT
  USING (is_active = TRUE);

-- RLS 策略：管理员可以查看所有公告
CREATE POLICY "管理员可以查看所有公告"
  ON public.announcements
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- RLS 策略：管理员可以插入公告
CREATE POLICY "管理员可以插入公告"
  ON public.announcements
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- RLS 策略：管理员可以更新公告
CREATE POLICY "管理员可以更新公告"
  ON public.announcements
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- RLS 策略：管理员可以删除公告
CREATE POLICY "管理员可以删除公告"
  ON public.announcements
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- 启用实时订阅
ALTER PUBLICATION supabase_realtime ADD TABLE public.announcements;

-- 添加注释
COMMENT ON TABLE public.announcements IS '系统公告表';
COMMENT ON COLUMN public.announcements.title IS '公告标题';
COMMENT ON COLUMN public.announcements.content IS '公告内容';
COMMENT ON COLUMN public.announcements.type IS '公告类型：info-信息, warning-警告, success-成功, error-错误, update-更新';
COMMENT ON COLUMN public.announcements.priority IS '优先级：0-10，数字越大优先级越高';
COMMENT ON COLUMN public.announcements.is_active IS '是否激活';
COMMENT ON COLUMN public.announcements.is_pinned IS '是否置顶';
COMMENT ON COLUMN public.announcements.target_audience IS '目标受众：all-所有人, users-普通用户, merchants-商家, partners-合作伙伴';
COMMENT ON COLUMN public.announcements.start_date IS '开始显示时间';
COMMENT ON COLUMN public.announcements.end_date IS '结束显示时间';
COMMENT ON COLUMN public.announcements.click_count IS '点击次数';
COMMENT ON COLUMN public.announcements.created_by IS '创建者';



-- =============================================
-- 文件: 045_create_system_settings_table.sql
-- =============================================

-- 创建系统设置表
CREATE TABLE IF NOT EXISTS system_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 基本配置
  platform_name TEXT DEFAULT '跨境服务商平台',
  platform_logo_url TEXT,
  platform_description TEXT DEFAULT '一个面向跨境电商服务商的展示和对接平台',

  -- 积分规则配置
  register_points INTEGER DEFAULT 100,
  invitation_points INTEGER DEFAULT 100,
  checkin_points INTEGER DEFAULT 5,
  checkin_7days_bonus INTEGER DEFAULT 20,
  checkin_30days_bonus INTEGER DEFAULT 50,
  merchant_register_points INTEGER DEFAULT 50,
  edit_merchant_cost INTEGER DEFAULT 100,
  view_contact_customer_cost INTEGER DEFAULT 10,
  view_contact_merchant_cost INTEGER DEFAULT 50,
  view_contact_merchant_deduct INTEGER DEFAULT 10, -- 被查看商家扣除的积分
  upload_avatar_reward INTEGER DEFAULT 30, -- 首次上传头像奖励
  deposit_merchant_daily_reward INTEGER DEFAULT 50, -- 押金商家每日登录奖励
  deposit_merchant_apply_reward INTEGER DEFAULT 1000, -- 押金商家申请通过一次性奖励
  merchant_top_cost_per_day INTEGER DEFAULT 1000, -- 商家置顶费用（积分/天）

  -- 押金配置
  deposit_refund_fee_rate DECIMAL(5,2) DEFAULT 5.00, -- 退还手续费率（百分比）
  deposit_violation_platform_rate DECIMAL(5,2) DEFAULT 30.00, -- 违规处罚平台抽成率
  deposit_violation_compensation_rate DECIMAL(5,2) DEFAULT 70.00, -- 违规处罚赔付率

  -- 信用分配置
  default_credit_score INTEGER DEFAULT 100,
  min_credit_score INTEGER DEFAULT 0,
  max_credit_score INTEGER DEFAULT 100,

  -- 安全配置
  max_login_attempts INTEGER DEFAULT 5,
  login_lockout_minutes INTEGER DEFAULT 30,
  session_timeout_hours INTEGER DEFAULT 24,

  -- 联系方式配置
  support_email TEXT,
  support_wechat TEXT,
  support_telegram TEXT,
  support_whatsapp TEXT,

  -- 时间戳
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id)
);

-- 创建更新时间触发器
CREATE OR REPLACE FUNCTION update_system_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_system_settings_updated_at_trigger
  BEFORE UPDATE ON system_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_system_settings_updated_at();

-- 插入默认配置（只有一条记录）
INSERT INTO system_settings (id)
VALUES ('00000000-0000-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;

-- 添加 RLS 策略
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- 所有人可以读取设置
CREATE POLICY "Anyone can read settings"
  ON system_settings
  FOR SELECT
  USING (true);

-- 只有管理员可以更新设置
CREATE POLICY "Only admins can update settings"
  ON system_settings
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- 添加注释
COMMENT ON TABLE system_settings IS '系统设置表（单例模式，只有一条记录）';
COMMENT ON COLUMN system_settings.platform_name IS '平台名称';
COMMENT ON COLUMN system_settings.register_points IS '注册奖励积分';
COMMENT ON COLUMN system_settings.invitation_points IS '邀请奖励积分';
COMMENT ON COLUMN system_settings.deposit_refund_fee_rate IS '押金退还手续费率（百分比）';
COMMENT ON COLUMN system_settings.default_credit_score IS '新商家默认信用分';



-- =============================================
-- 文件: 046_update_registration_trigger_use_settings.sql
-- =============================================

-- 修改注册触发器，从系统设置读取注册奖励积分

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invitation_code TEXT;
  v_register_points INTEGER;
BEGIN
  -- 从系统设置获取注册奖励积分
  SELECT register_points INTO v_register_points
  FROM system_settings
  WHERE id = '00000000-0000-0000-0000-000000000001'
  LIMIT 1;

  -- 如果没有设置，使用默认值100
  IF v_register_points IS NULL THEN
    v_register_points := 100;
  END IF;

  -- 生成邀请码
  v_invitation_code := generate_invitation_code();

  -- 插入用户 profile，包含邀请码
  INSERT INTO public.profiles (id, username, points, is_merchant, invitation_code)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1)),
    v_register_points,  -- 使用系统设置的注册积分
    false,
    v_invitation_code
  )
  ON CONFLICT (id) DO NOTHING;

  -- 使用新的 record_point_transaction 函数记录注册积分
  PERFORM record_point_transaction(
    new.id,
    v_register_points,
    'registration',
    '注册赠送积分 +' || v_register_points || '积分',
    NULL,
    NULL,
    jsonb_build_object('source', 'registration')
  );

  -- 发送注册欢迎通知
  PERFORM create_notification(
    new.id,
    'system',
    'registration',
    '欢迎加入',
    '注册成功！您已获得 ' || v_register_points || ' 积分奖励，快去体验吧！',
    NULL,
    NULL,
    jsonb_build_object('points', v_register_points),
    'normal',
    NULL
  );

  RETURN new;
END;
$$;

-- 确保触发器存在
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

COMMENT ON FUNCTION public.handle_new_user IS '处理新用户注册：创建profile、发放注册积分（从系统设置读取）、发送欢迎通知';



-- =============================================
-- 文件: 047_add_missing_point_fields.sql
-- =============================================

-- 添加缺失的积分配置字段到 system_settings 表

-- 检查表是否存在
DO $$
BEGIN
  -- 添加首次上传头像奖励字段
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'system_settings'
    AND column_name = 'upload_avatar_reward'
  ) THEN
    ALTER TABLE system_settings
    ADD COLUMN upload_avatar_reward INTEGER DEFAULT 30;

    COMMENT ON COLUMN system_settings.upload_avatar_reward IS '首次上传头像奖励积分';
  END IF;

  -- 添加押金商家每日登录奖励字段
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'system_settings'
    AND column_name = 'deposit_merchant_daily_reward'
  ) THEN
    ALTER TABLE system_settings
    ADD COLUMN deposit_merchant_daily_reward INTEGER DEFAULT 50;

    COMMENT ON COLUMN system_settings.deposit_merchant_daily_reward IS '押金商家每日登录奖励积分';
  END IF;

  -- 添加押金商家审核通过奖励字段
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'system_settings'
    AND column_name = 'deposit_merchant_apply_reward'
  ) THEN
    ALTER TABLE system_settings
    ADD COLUMN deposit_merchant_apply_reward INTEGER DEFAULT 1000;

    COMMENT ON COLUMN system_settings.deposit_merchant_apply_reward IS '押金商家审核通过一次性奖励积分';
  END IF;

  -- 添加商家置顶费用字段
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'system_settings'
    AND column_name = 'merchant_top_cost_per_day'
  ) THEN
    ALTER TABLE system_settings
    ADD COLUMN merchant_top_cost_per_day INTEGER DEFAULT 1000;

    COMMENT ON COLUMN system_settings.merchant_top_cost_per_day IS '商家置顶费用（积分/天）';
  END IF;

  RAISE NOTICE '✅ 成功添加4个新的积分配置字段';
END $$;

-- 更新现有记录，确保新字段有默认值
UPDATE system_settings
SET
  upload_avatar_reward = COALESCE(upload_avatar_reward, 30),
  deposit_merchant_daily_reward = COALESCE(deposit_merchant_daily_reward, 50),
  deposit_merchant_apply_reward = COALESCE(deposit_merchant_apply_reward, 1000),
  merchant_top_cost_per_day = COALESCE(merchant_top_cost_per_day, 1000)
WHERE id = '00000000-0000-0000-0000-000000000001';



-- =============================================
-- 文件: 048_add_view_contact_merchant_deduct.sql
-- =============================================

-- 添加 view_contact_merchant_deduct 字段（如果不存在）
-- 说明：被查看商家需要扣除的积分

DO $$
BEGIN
  -- 检查字段是否存在
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'system_settings'
    AND column_name = 'view_contact_merchant_deduct'
  ) THEN
    -- 添加字段
    ALTER TABLE system_settings
    ADD COLUMN view_contact_merchant_deduct INTEGER DEFAULT 10;

    -- 添加注释
    COMMENT ON COLUMN system_settings.view_contact_merchant_deduct IS '被查看商家扣除的积分';

    RAISE NOTICE '✅ 成功添加字段: view_contact_merchant_deduct';
  ELSE
    RAISE NOTICE '✓ 字段已存在: view_contact_merchant_deduct';
  END IF;
END $$;

-- 确保现有记录有这个字段的值
UPDATE system_settings
SET view_contact_merchant_deduct = COALESCE(view_contact_merchant_deduct, 10)
WHERE id = '00000000-0000-0000-0000-000000000001';

-- 重新加载 PostgREST 架构缓存
NOTIFY pgrst, 'reload schema';

-- 验证字段已添加
SELECT
  column_name,
  data_type,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'system_settings'
  AND column_name = 'view_contact_merchant_deduct';

-- 查看当前值
SELECT view_contact_merchant_deduct
FROM system_settings
WHERE id = '00000000-0000-0000-0000-000000000001';



-- =============================================
-- 文件: 049_create_admin_logs_table.sql
-- =============================================

-- 创建管理员操作日志表
CREATE TABLE IF NOT EXISTS admin_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action_type VARCHAR(50) NOT NULL, -- 操作类型: user_ban, user_unban, merchant_approve, merchant_reject, deposit_approve, deposit_reject, refund_approve, refund_reject, report_handle, partner_approve, partner_reject, announcement_create, announcement_update, announcement_delete, settings_update等
  target_type VARCHAR(50), -- 目标类型: user, merchant, deposit_application, refund_application, report, partner, announcement, settings
  target_id UUID, -- 目标ID
  old_data JSONB, -- 操作前的数据
  new_data JSONB, -- 操作后的数据
  description TEXT, -- 操作描述
  ip_address INET, -- IP地址
  user_agent TEXT, -- 用户代理
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_admin_logs_admin_id ON admin_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_logs_action_type ON admin_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_admin_logs_target_type ON admin_logs(target_type);
CREATE INDEX IF NOT EXISTS idx_admin_logs_target_id ON admin_logs(target_id);
CREATE INDEX IF NOT EXISTS idx_admin_logs_created_at ON admin_logs(created_at DESC);

-- 启用RLS
ALTER TABLE admin_logs ENABLE ROW LEVEL SECURITY;

-- 创建RLS策略: 只有管理员可以查看所有日志
CREATE POLICY "管理员可以查看所有日志"
  ON admin_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- 创建RLS策略: 系统可以插入日志(通过服务角色)
CREATE POLICY "系统可以插入日志"
  ON admin_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- 创建视图: 日志详情视图(包含管理员信息)
CREATE OR REPLACE VIEW admin_logs_with_details AS
SELECT
  al.id,
  al.admin_id,
  p.username AS admin_username,
  au.email AS admin_email,
  al.action_type,
  al.target_type,
  al.target_id,
  al.old_data,
  al.new_data,
  al.description,
  al.ip_address,
  al.user_agent,
  al.created_at
FROM admin_logs al
LEFT JOIN profiles p ON al.admin_id = p.id
LEFT JOIN auth.users au ON al.admin_id = au.id;

-- 授予视图查询权限
GRANT SELECT ON admin_logs_with_details TO authenticated;

COMMENT ON TABLE admin_logs IS '管理员操作日志表,记录所有管理后台的操作行为';
COMMENT ON COLUMN admin_logs.action_type IS '操作类型,如: user_ban, merchant_approve, deposit_approve等';
COMMENT ON COLUMN admin_logs.target_type IS '操作目标类型,如: user, merchant, deposit_application等';
COMMENT ON COLUMN admin_logs.target_id IS '操作目标的ID';
COMMENT ON COLUMN admin_logs.old_data IS '操作前的数据快照(JSON格式)';
COMMENT ON COLUMN admin_logs.new_data IS '操作后的数据快照(JSON格式)';



-- =============================================
-- 文件: 050_add_login_security_fields.sql
-- =============================================

-- 添加登录安全相关字段到 profiles 表
-- 用于实现登录失败次数限制和账号锁定功能

-- 添加登录失败次数字段
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS login_failed_attempts INTEGER DEFAULT 0;

-- 添加账号锁定时间字段
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS account_locked_until TIMESTAMPTZ;

-- 添加最后登录失败时间字段（用于追踪）
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS last_failed_login_at TIMESTAMPTZ;

-- 添加注释
COMMENT ON COLUMN profiles.login_failed_attempts IS '登录失败次数';
COMMENT ON COLUMN profiles.account_locked_until IS '账号锁定截止时间';
COMMENT ON COLUMN profiles.last_failed_login_at IS '最后一次登录失败时间';



-- =============================================
-- 文件: 051_add_email_to_profiles.sql
-- =============================================

-- 添加 email 字段到 profiles 表并同步 auth.users 的 email
-- 这样可以通过 email 查询并实现登录安全功能

-- 1. 添加 email 字段
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS email TEXT;

-- 2. 创建唯一索引
CREATE UNIQUE INDEX IF NOT EXISTS profiles_email_idx ON profiles(email);

-- 3. 从 auth.users 同步现有数据
UPDATE profiles
SET email = auth.users.email
FROM auth.users
WHERE profiles.id = auth.users.id
AND profiles.email IS NULL;

-- 4. 创建触发器函数：当 auth.users 的 email 更新时同步到 profiles
CREATE OR REPLACE FUNCTION sync_email_to_profile()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE profiles
  SET email = NEW.email
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. 创建触发器
DROP TRIGGER IF EXISTS sync_email_trigger ON auth.users;
CREATE TRIGGER sync_email_trigger
AFTER INSERT OR UPDATE OF email ON auth.users
FOR EACH ROW
EXECUTE FUNCTION sync_email_to_profile();

-- 6. 添加注释
COMMENT ON COLUMN profiles.email IS '用户邮箱（从 auth.users 同步）';



-- =============================================
-- 文件: 052_create_coin_exchange_records_table.sql
-- =============================================

-- 创建硬币兑换积分记录表
-- 用于记录论坛硬币兑换商家平台积分的所有交易

CREATE TABLE IF NOT EXISTS coin_exchange_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 用户信息
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_email TEXT NOT NULL,

  -- 论坛相关信息
  forum_user_id TEXT NOT NULL, -- 论坛的用户ID
  forum_transaction_id TEXT NOT NULL UNIQUE, -- 论坛的交易ID（用于防重放）

  -- 兑换信息
  coin_amount INTEGER NOT NULL CHECK (coin_amount > 0), -- 消耗的硬币数量
  points_amount INTEGER NOT NULL CHECK (points_amount > 0), -- 获得的积分数量
  exchange_rate DECIMAL(10,2) NOT NULL DEFAULT 0.1, -- 兑换比例（1积分=10硬币，即0.1）

  -- 状态信息
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),

  -- 请求信息
  request_ip TEXT, -- 请求IP（用于安全审计）
  request_signature TEXT NOT NULL, -- 请求签名
  request_timestamp BIGINT NOT NULL, -- 请求时间戳（毫秒）

  -- 失败原因
  failure_reason TEXT,

  -- 时间戳
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE -- 完成时间
);

-- 创建索引以提高查询性能
CREATE INDEX idx_coin_exchange_user_id ON coin_exchange_records(user_id);
CREATE INDEX idx_coin_exchange_user_email ON coin_exchange_records(user_email);
CREATE INDEX idx_coin_exchange_forum_user_id ON coin_exchange_records(forum_user_id);
CREATE INDEX idx_coin_exchange_status ON coin_exchange_records(status);
CREATE INDEX idx_coin_exchange_created_at ON coin_exchange_records(created_at DESC);

-- 复合索引用于日限额查询
-- 注意：不使用 DATE() 函数，直接对完整时间戳建索引，查询时在 WHERE 条件中使用日期范围
CREATE INDEX idx_coin_exchange_daily_limit ON coin_exchange_records(user_email, created_at, status)
WHERE status = 'completed';

-- 启用 RLS
ALTER TABLE coin_exchange_records ENABLE ROW LEVEL SECURITY;

-- 用户只能查看自己的兑换记录
CREATE POLICY "Users can view own exchange records"
  ON coin_exchange_records
  FOR SELECT
  USING (auth.uid() = user_id);

-- 管理员可以查看所有记录
CREATE POLICY "Admins can view all exchange records"
  ON coin_exchange_records
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- 只允许通过 API 插入记录（使用 service_role 密钥）
-- 普通用户和管理员都不能直接插入
CREATE POLICY "Only service role can insert exchange records"
  ON coin_exchange_records
  FOR INSERT
  WITH CHECK (false);

-- 添加表注释
COMMENT ON TABLE coin_exchange_records IS '硬币兑换积分记录表 - 记录论坛硬币兑换商家平台积分的所有交易';
COMMENT ON COLUMN coin_exchange_records.forum_transaction_id IS '论坛的交易ID，用于防止重放攻击，必须唯一';
COMMENT ON COLUMN coin_exchange_records.coin_amount IS '消耗的硬币数量（论坛货币）';
COMMENT ON COLUMN coin_exchange_records.points_amount IS '获得的积分数量（商家平台积分）';
COMMENT ON COLUMN coin_exchange_records.exchange_rate IS '兑换比例：1积分需要多少硬币（默认0.1表示1积分=10硬币）';
COMMENT ON COLUMN coin_exchange_records.request_signature IS 'API请求签名，用于验证请求来源';
COMMENT ON COLUMN coin_exchange_records.request_timestamp IS '请求时间戳（毫秒），用于防重放攻击';



-- =============================================
-- 文件: 053_add_email_validation_settings.sql
-- =============================================

-- 添加邮箱验证配置到系统设置表
-- 文件: 053_add_email_validation_settings.sql

-- 1. 添加邮箱验证配置字段
ALTER TABLE system_settings
  ADD COLUMN IF NOT EXISTS email_validation_enabled BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS email_validation_mode TEXT DEFAULT 'both' CHECK (email_validation_mode IN ('whitelist', 'blacklist', 'both', 'disabled')),
  ADD COLUMN IF NOT EXISTS email_allowed_domains TEXT[] DEFAULT ARRAY[
    -- 国际主流邮箱
    'gmail.com', 'outlook.com', 'hotmail.com', 'yahoo.com', 'icloud.com', 'protonmail.com', 'aol.com',
    -- 中国主流邮箱
    'qq.com', 'vip.qq.com', 'foxmail.com', '163.com', 'vip.163.com', '126.com', 'yeah.net', '188.com',
    'sina.com', 'sina.cn', 'sohu.com', 'tom.com', '139.com', '189.cn', 'wo.cn', 'aliyun.com'
  ],
  ADD COLUMN IF NOT EXISTS email_blocked_domains TEXT[] DEFAULT ARRAY[
    -- 常见一次性邮箱
    '10minutemail.com', '20minutemail.com', 'tempmail.com', 'guerrillamail.com', 'mailinator.com',
    'throwaway.email', 'yopmail.com', 'maildrop.cc', 'getnada.com', 'temp-mail.org', 'mohmal.com',
    'sharklasers.com', 'guerrillamail.info', 'grr.la', 'guerrillamailblock.com', 'pokemail.net',
    'spam4.me', 'trashmail.com', 'trashmail.net', 'emailondeck.com', 'fakeinbox.com', 'mailnesia.com',
    'mintemail.com', 'mytrashmail.com', 'tempinbox.com', 'jetable.org', 'getairmail.com',
    'dispostable.com', 'bugmenot.com', 'mt2015.com', 'bccto.me', 'disposableemailaddresses.com',
    -- 中文一次性邮箱
    'linshiyouxiang.net', '027168.com', 'zzrgg.com', 'bccto.cc', 'chacuo.net'
  ];

-- 2. 添加字段注释
COMMENT ON COLUMN system_settings.email_validation_enabled IS '是否启用邮箱验证（true=启用，false=禁用）';
COMMENT ON COLUMN system_settings.email_validation_mode IS '邮箱验证模式：whitelist=白名单，blacklist=黑名单，both=混合，disabled=禁用';
COMMENT ON COLUMN system_settings.email_allowed_domains IS '允许的邮箱域名列表（白名单）';
COMMENT ON COLUMN system_settings.email_blocked_domains IS '禁止的邮箱域名列表（黑名单）';

-- 3. 更新现有记录（如果存在）
UPDATE system_settings
SET
  email_validation_enabled = true,
  email_validation_mode = 'both'
WHERE id = '00000000-0000-0000-0000-000000000001';

-- 4. 输出确认信息
DO $$
BEGIN
  RAISE NOTICE '✅ 邮箱验证配置已添加到系统设置表';
  RAISE NOTICE '   - email_validation_enabled: 是否启用邮箱验证';
  RAISE NOTICE '   - email_validation_mode: 验证模式（whitelist/blacklist/both/disabled）';
  RAISE NOTICE '   - email_allowed_domains: 白名单（默认包含主流邮箱）';
  RAISE NOTICE '   - email_blocked_domains: 黑名单（默认包含一次性邮箱）';
  RAISE NOTICE '';
  RAISE NOTICE '📝 管理员可以在后台管理页面修改这些设置';
END $$;



-- =============================================
-- 文件: 054.5_create_platform_assets_bucket.sql
-- =============================================

-- 创建平台资源存储桶
-- 在 Supabase Storage 中创建用于存储平台资源（如 logo）的存储桶

-- 注意：此脚本需要在 Supabase Dashboard 的 SQL Editor 中执行
-- 或者你可以直接在 Supabase Dashboard > Storage 界面手动创建

-- 注意：存储桶已通过 Dashboard 或 SQL 手动创建，跳过 INSERT 操作
-- INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
-- VALUES (
--   'platform-assets',
--   'platform-assets',
--   true, -- 公开访问
--   2097152, -- 2MB 文件大小限制
--   ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']::text[]
-- )
-- ON CONFLICT (id) DO NOTHING;

-- 删除可能存在的旧策略
DROP POLICY IF EXISTS "公开读取平台资源" ON storage.objects;
DROP POLICY IF EXISTS "管理员可以上传平台资源" ON storage.objects;
DROP POLICY IF EXISTS "管理员可以更新平台资源" ON storage.objects;
DROP POLICY IF EXISTS "管理员可以删除平台资源" ON storage.objects;

-- 创建存储策略：允许所有人读取
CREATE POLICY "公开读取平台资源"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'platform-assets');

-- 创建存储策略：只有管理员可以上传
CREATE POLICY "管理员可以上传平台资源"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'platform-assets'
  AND EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND (profiles.role = 'admin' OR profiles.role = 'super_admin')
  )
);

-- 创建存储策略：只有管理员可以更新
CREATE POLICY "管理员可以更新平台资源"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'platform-assets'
  AND EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND (profiles.role = 'admin' OR profiles.role = 'super_admin')
  )
);

-- 创建存储策略：只有管理员可以删除
CREATE POLICY "管理员可以删除平台资源"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'platform-assets'
  AND EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND (profiles.role = 'admin' OR profiles.role = 'super_admin')
  )
);

-- COMMENT ON TABLE storage.buckets IS '存储桶: platform-assets 用于存储平台资源文件（如 logo、banner 等）';



-- =============================================
-- 文件: 055.5_fix_schema_cache.sql
-- =============================================

-- ============================================================
-- 修复 PostgREST 架构缓存问题
-- ============================================================
-- 说明: 如果 PostgREST 无法找到表或字段,需要重新加载架构缓存
--
-- 使用方法:
-- 1. 打开 Supabase Dashboard
-- 2. 进入 SQL Editor
-- 3. 复制并执行此脚本
-- ============================================================

-- 步骤 1: 通知 PostgREST 重新加载架构
NOTIFY pgrst, 'reload schema';

-- 步骤 2: 等待几秒后,验证 system_settings 表是否存在
SELECT
  table_name,
  table_schema
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name = 'system_settings';

-- 步骤 3: 检查 system_settings 表的所有字段
SELECT
  column_name,
  data_type,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'system_settings'
ORDER BY ordinal_position;

-- 步骤 4: 如果表不存在,创建它(执行基础迁移)
-- 注意: 如果表已存在,这部分会被跳过

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'system_settings'
  ) THEN
    RAISE NOTICE '⚠️  system_settings 表不存在,需要先执行 scripts/045_create_system_settings_table.sql';
  ELSE
    RAISE NOTICE '✅ system_settings 表已存在';
  END IF;
END $$;

-- 步骤 5: 添加缺失的字段
DO $$
BEGIN
  -- 检查并添加 upload_avatar_reward 字段
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'system_settings'
    AND column_name = 'upload_avatar_reward'
  ) THEN
    ALTER TABLE system_settings
    ADD COLUMN upload_avatar_reward INTEGER DEFAULT 30;
    COMMENT ON COLUMN system_settings.upload_avatar_reward IS '首次上传头像奖励积分';
    RAISE NOTICE '✅ 添加字段: upload_avatar_reward';
  ELSE
    RAISE NOTICE '✓ 字段已存在: upload_avatar_reward';
  END IF;

  -- 检查并添加 deposit_merchant_daily_reward 字段
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'system_settings'
    AND column_name = 'deposit_merchant_daily_reward'
  ) THEN
    ALTER TABLE system_settings
    ADD COLUMN deposit_merchant_daily_reward INTEGER DEFAULT 50;
    COMMENT ON COLUMN system_settings.deposit_merchant_daily_reward IS '押金商家每日登录奖励积分';
    RAISE NOTICE '✅ 添加字段: deposit_merchant_daily_reward';
  ELSE
    RAISE NOTICE '✓ 字段已存在: deposit_merchant_daily_reward';
  END IF;

  -- 检查并添加 deposit_merchant_apply_reward 字段
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'system_settings'
    AND column_name = 'deposit_merchant_apply_reward'
  ) THEN
    ALTER TABLE system_settings
    ADD COLUMN deposit_merchant_apply_reward INTEGER DEFAULT 1000;
    COMMENT ON COLUMN system_settings.deposit_merchant_apply_reward IS '押金商家审核通过一次性奖励积分';
    RAISE NOTICE '✅ 添加字段: deposit_merchant_apply_reward';
  ELSE
    RAISE NOTICE '✓ 字段已存在: deposit_merchant_apply_reward';
  END IF;

  -- 检查并添加 merchant_top_cost_per_day 字段
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'system_settings'
    AND column_name = 'merchant_top_cost_per_day'
  ) THEN
    ALTER TABLE system_settings
    ADD COLUMN merchant_top_cost_per_day INTEGER DEFAULT 1000;
    COMMENT ON COLUMN system_settings.merchant_top_cost_per_day IS '商家置顶费用（积分/天）';
    RAISE NOTICE '✅ 添加字段: merchant_top_cost_per_day';
  ELSE
    RAISE NOTICE '✓ 字段已存在: merchant_top_cost_per_day';
  END IF;
END $$;

-- 步骤 6: 更新现有记录,确保新字段有默认值
UPDATE system_settings
SET
  upload_avatar_reward = COALESCE(upload_avatar_reward, 30),
  deposit_merchant_daily_reward = COALESCE(deposit_merchant_daily_reward, 50),
  deposit_merchant_apply_reward = COALESCE(deposit_merchant_apply_reward, 1000),
  merchant_top_cost_per_day = COALESCE(merchant_top_cost_per_day, 1000)
WHERE id = '00000000-0000-0000-0000-000000000001';

-- 步骤 7: 再次通知 PostgREST 重新加载架构
NOTIFY pgrst, 'reload schema';

-- 步骤 8: 验证更新后的表结构
SELECT
  column_name,
  data_type,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'system_settings'
  AND column_name IN (
    'upload_avatar_reward',
    'deposit_merchant_daily_reward',
    'deposit_merchant_apply_reward',
    'merchant_top_cost_per_day'
  )
ORDER BY column_name;

-- 步骤 9: 查看当前系统设置
SELECT
  checkin_points,
  invitation_points,
  register_points,
  merchant_register_points,
  edit_merchant_cost,
  upload_avatar_reward,
  deposit_merchant_daily_reward,
  deposit_merchant_apply_reward,
  merchant_top_cost_per_day
FROM system_settings
WHERE id = '00000000-0000-0000-0000-000000000001';

-- ============================================================
-- 执行完成后的操作:
-- ============================================================
-- 1. 检查上面的输出,确认所有字段都已添加
-- 2. 在浏览器中访问 http://localhost:3000/
-- 3. 如果仍然出现错误,请等待 30 秒让 PostgREST 刷新缓存
-- 4. 如果问题仍然存在,尝试重启 Next.js 开发服务器
-- ============================================================



-- =============================================
-- 文件: 056_fix_user_creation_trigger.sql
-- =============================================

-- ============================================================
-- 修复用户创建触发器问题
-- ============================================================
-- 问题: 管理员通过 Admin API 创建用户时，触发器执行失败
-- 原因: 触发器中的函数调用可能有时序问题
-- 解决方案: 使用更健壮的错误处理和事务管理
-- ============================================================

-- 步骤 1: 创建更健壮的用户注册触发器函数
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invitation_code TEXT;
  v_register_points INTEGER;
  v_profile_exists BOOLEAN;
BEGIN
  -- 检查 profile 是否已存在 (避免重复创建)
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = new.id
  ) INTO v_profile_exists;

  IF v_profile_exists THEN
    RAISE NOTICE 'Profile already exists for user %, skipping trigger', new.id;
    RETURN new;
  END IF;

  -- 从系统设置获取注册奖励积分
  SELECT register_points INTO v_register_points
  FROM system_settings
  WHERE id = '00000000-0000-0000-0000-000000000001'
  LIMIT 1;

  -- 如果没有设置，使用默认值100
  IF v_register_points IS NULL THEN
    v_register_points := 100;
    RAISE NOTICE 'Using default register_points: %', v_register_points;
  END IF;

  -- 生成邀请码
  BEGIN
    v_invitation_code := generate_invitation_code();
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Failed to generate invitation code: %, using fallback', SQLERRM;
    v_invitation_code := substring(md5(random()::text || new.id::text) from 1 for 8);
  END;

  -- 插入用户 profile
  BEGIN
    INSERT INTO public.profiles (id, username, points, is_merchant, invitation_code)
    VALUES (
      new.id,
      COALESCE(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1)),
      v_register_points,
      false,
      v_invitation_code
    )
    ON CONFLICT (id) DO NOTHING;

    RAISE NOTICE 'Created profile for user % with % points', new.id, v_register_points;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Failed to create profile: %', SQLERRM;
    -- 不要中止事务，继续执行
  END;

  -- 记录注册积分交易
  BEGIN
    PERFORM record_point_transaction(
      new.id,
      v_register_points,
      'registration',
      '注册赠送积分 +' || v_register_points || '积分',
      NULL,
      NULL,
      jsonb_build_object('source', 'registration')
    );
    RAISE NOTICE 'Recorded point transaction for user %', new.id;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Failed to record point transaction: %', SQLERRM;
    -- 不要中止事务，继续执行
  END;

  -- 发送注册欢迎通知
  BEGIN
    PERFORM create_notification(
      new.id,
      'system',
      'registration',
      '欢迎加入',
      '注册成功！您已获得 ' || v_register_points || ' 积分奖励，快去体验吧！',
      NULL,
      NULL,
      jsonb_build_object('points', v_register_points),
      'normal',
      NULL
    );
    RAISE NOTICE 'Created welcome notification for user %', new.id;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Failed to create notification: %', SQLERRM;
    -- 不要中止事务，继续执行
  END;

  RETURN new;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Error in handle_new_user trigger: %', SQLERRM;
  -- 即使触发器失败，也允许用户创建成功
  RETURN new;
END;
$$;

-- 步骤 2: 确保触发器存在
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 步骤 3: 更新函数注释
COMMENT ON FUNCTION public.handle_new_user IS '处理新用户注册：创建profile、发放注册积分、发送欢迎通知（带错误处理）';

-- ============================================================
-- 执行完成！
-- ============================================================
-- 说明:
-- 1. 新版本触发器增加了完善的错误处理
-- 2. 即使某个步骤失败,也不会阻止用户创建
-- 3. 所有错误都会记录为 WARNING,方便调试
-- 4. 检查 profile 是否已存在,避免重复创建
-- ============================================================



-- =============================================
-- 文件: 057_fix_trigger_add_email.sql
-- =============================================

-- ============================================================
-- 修复用户创建触发器 - 添加 email 字段
-- ============================================================
-- 问题: profiles 表的 email 字段可能是必填的，但触发器没有设置
-- 解决方案: 在创建 profile 时包含 email 字段
-- ============================================================

-- 创建正确的用户注册触发器函数
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invitation_code TEXT;
  v_register_points INTEGER;
  v_profile_exists BOOLEAN;
BEGIN
  -- 检查 profile 是否已存在 (避免重复创建)
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = new.id
  ) INTO v_profile_exists;

  IF v_profile_exists THEN
    RAISE NOTICE 'Profile already exists for user %, skipping trigger', new.id;
    RETURN new;
  END IF;

  -- 从系统设置获取注册奖励积分
  SELECT register_points INTO v_register_points
  FROM system_settings
  WHERE id = '00000000-0000-0000-0000-000000000001'
  LIMIT 1;

  -- 如果没有设置，使用默认值100
  IF v_register_points IS NULL THEN
    v_register_points := 100;
    RAISE NOTICE 'Using default register_points: %', v_register_points;
  END IF;

  -- 生成邀请码
  BEGIN
    v_invitation_code := generate_invitation_code();
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Failed to generate invitation code: %, using fallback', SQLERRM;
    v_invitation_code := substring(md5(random()::text || new.id::text) from 1 for 8);
  END;

  -- 插入用户 profile (包含 email 字段!)
  BEGIN
    INSERT INTO public.profiles (
      id,
      username,
      email,           -- ✅ 添加 email 字段
      points,
      is_merchant,
      invitation_code,
      role,            -- ✅ 添加 role 字段
      created_at,
      updated_at
    )
    VALUES (
      new.id,
      COALESCE(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1)),
      new.email,       -- ✅ 使用认证用户的 email
      v_register_points,
      false,
      v_invitation_code,
      'user',          -- ✅ 默认角色为 user
      NOW(),
      NOW()
    )
    ON CONFLICT (id) DO NOTHING;

    RAISE NOTICE 'Created profile for user % with % points', new.id, v_register_points;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Failed to create profile: %', SQLERRM;
    -- 不要中止事务，继续执行
  END;

  -- 记录注册积分交易
  BEGIN
    PERFORM record_point_transaction(
      new.id,
      v_register_points,
      'registration',
      '注册赠送积分 +' || v_register_points || '积分',
      NULL,
      NULL,
      jsonb_build_object('source', 'registration')
    );
    RAISE NOTICE 'Recorded point transaction for user %', new.id;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Failed to record point transaction: %', SQLERRM;
    -- 不要中止事务，继续执行
  END;

  -- 发送注册欢迎通知
  BEGIN
    PERFORM create_notification(
      new.id,
      'system',
      'registration',
      '欢迎加入',
      '注册成功！您已获得 ' || v_register_points || ' 积分奖励，快去体验吧！',
      NULL,
      NULL,
      jsonb_build_object('points', v_register_points),
      'normal',
      NULL
    );
    RAISE NOTICE 'Created welcome notification for user %', new.id;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Failed to create notification: %', SQLERRM;
    -- 不要中止事务，继续执行
  END;

  RETURN new;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Error in handle_new_user trigger: %', SQLERRM;
  -- 即使触发器失败，也允许用户创建成功
  RETURN new;
END;
$$;

-- 确保触发器存在
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 更新函数注释
COMMENT ON FUNCTION public.handle_new_user IS '处理新用户注册：创建profile（含email）、发放注册积分、发送欢迎通知（带错误处理）';

-- ============================================================
-- 执行完成！
-- ============================================================
-- 修改内容:
-- 1. ✅ 在 INSERT 语句中添加了 email 字段
-- 2. ✅ 在 INSERT 语句中添加了 role 字段（默认为 'user'）
-- 3. ✅ 明确设置 created_at 和 updated_at
-- 4. ✅ 保留了所有错误处理机制
-- ============================================================



-- =============================================
-- 文件: 058_disable_trigger_temporary.sql
-- =============================================

-- ============================================================
-- 临时方案：禁用触发器，改为手动创建 profile
-- ============================================================
-- 由于触发器一直报错且无法获取详细日志，我们先禁用触发器
-- 改为在应用层手动创建 profile
-- ============================================================

-- 步骤 1: 禁用自动触发器
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- 步骤 2: 保留触发器函数以便将来调试
COMMENT ON FUNCTION public.handle_new_user IS '用户注册触发器（已禁用，改为应用层处理）';

-- ============================================================
-- 执行完成！
-- ============================================================
-- 说明:
-- 1. 触发器已禁用
-- 2. 应用层将手动创建 profile、积分记录和通知
-- 3. 这是临时方案，等找到触发器错误原因后可以重新启用
-- ============================================================

SELECT '✅ 触发器已禁用，现在可以通过应用层创建用户了' as status;



-- =============================================
-- 文件: 059_find_and_disable_all_triggers.sql
-- =============================================

-- ============================================================
-- 查找并禁用所有相关的触发器
-- ============================================================

-- 步骤 1: 查看 auth.users 表上的所有触发器
SELECT
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement,
  action_timing
FROM information_schema.triggers
WHERE event_object_schema = 'auth'
  AND event_object_table = 'users';

-- 步骤 2: 禁用所有可能的触发器
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS handle_new_user ON auth.users;
DROP TRIGGER IF EXISTS on_user_created ON auth.users;
DROP TRIGGER IF EXISTS trigger_new_user ON auth.users;

-- 步骤 3: 再次查看是否还有触发器
SELECT
  trigger_name,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE event_object_schema = 'auth'
  AND event_object_table = 'users';

-- 步骤 4: 如果上面显示还有触发器，记录下来
DO $$
DECLARE
  trigger_record RECORD;
  trigger_count INTEGER := 0;
BEGIN
  FOR trigger_record IN
    SELECT trigger_name
    FROM information_schema.triggers
    WHERE event_object_schema = 'auth'
      AND event_object_table = 'users'
  LOOP
    trigger_count := trigger_count + 1;
    RAISE NOTICE '⚠️  发现触发器: %', trigger_record.trigger_name;
  END LOOP;

  IF trigger_count = 0 THEN
    RAISE NOTICE '✅ auth.users 表上没有触发器了';
  ELSE
    RAISE NOTICE '❌ auth.users 表上还有 % 个触发器', trigger_count;
  END IF;
END $$;

-- ============================================================
-- 执行完成！请查看上面的输出
-- ============================================================



-- =============================================
-- 文件: 060_disable_sync_email_trigger.sql
-- =============================================

-- ============================================================
-- 禁用 sync_email_trigger 触发器
-- ============================================================
-- 发现问题：sync_email_trigger 触发器在创建用户时失败
-- 这个触发器调用 sync_email_to_profile() 函数
-- ============================================================

-- 步骤 1: 禁用 sync_email_trigger 触发器
DROP TRIGGER IF EXISTS sync_email_trigger ON auth.users;

-- 步骤 2: 验证触发器是否已删除
SELECT
  trigger_name,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE event_object_schema = 'auth'
  AND event_object_table = 'users';

-- 步骤 3: 确认结果
DO $$
DECLARE
  trigger_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO trigger_count
  FROM information_schema.triggers
  WHERE event_object_schema = 'auth'
    AND event_object_table = 'users';

  IF trigger_count = 0 THEN
    RAISE NOTICE '✅ auth.users 表上的所有触发器已禁用';
  ELSE
    RAISE NOTICE '⚠️  auth.users 表上还有 % 个触发器', trigger_count;
  END IF;
END $$;

-- ============================================================
-- 执行完成！
-- ============================================================
-- 说明:
-- 1. sync_email_trigger 触发器已禁用
-- 2. 应用层会在创建 profile 时直接设置 email 字段
-- 3. 不需要这个同步触发器
-- ============================================================

SELECT '✅ sync_email_trigger 已禁用，现在可以创建用户了' as status;



-- =============================================
-- 文件: 061_final_fix_user_trigger.sql
-- =============================================

-- ============================================================
-- 最终修复：创建正确的用户注册触发器
-- ============================================================
-- 目标：
-- 1. 支持前端用户正常注册（auth.signUp）
-- 2. 支持管理员创建用户（auth.admin.createUser）
-- 3. 不依赖 sync_email_trigger（已禁用）
-- ============================================================

-- 步骤 1: 创建修复后的触发器函数
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invitation_code TEXT;
  v_register_points INTEGER;
  v_profile_exists BOOLEAN;
BEGIN
  -- 检查 profile 是否已存在
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = new.id
  ) INTO v_profile_exists;

  IF v_profile_exists THEN
    RAISE NOTICE 'Profile already exists for user %, skipping', new.id;
    RETURN new;
  END IF;

  -- 从系统设置获取注册积分
  SELECT register_points INTO v_register_points
  FROM system_settings
  WHERE id = '00000000-0000-0000-0000-000000000001'
  LIMIT 1;

  IF v_register_points IS NULL THEN
    v_register_points := 100;
  END IF;

  -- 生成邀请码
  BEGIN
    v_invitation_code := generate_invitation_code();
  EXCEPTION WHEN OTHERS THEN
    v_invitation_code := substring(md5(random()::text || new.id::text) from 1 for 8);
  END;

  -- 创建 profile（包含 email 字段，这样就不需要 sync_email_trigger 了）
  BEGIN
    INSERT INTO public.profiles (
      id,
      username,
      email,
      points,
      is_merchant,
      invitation_code,
      role,
      consecutive_checkin_days,
      report_count,
      is_banned,
      login_failed_attempts,
      created_at,
      updated_at
    )
    VALUES (
      new.id,
      COALESCE(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1)),
      new.email,
      v_register_points,
      false,
      v_invitation_code,
      'user',
      0,
      0,
      false,
      0,
      NOW(),
      NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      email = EXCLUDED.email,
      updated_at = NOW();

    RAISE NOTICE 'Profile created/updated for user %', new.id;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Failed to create profile: %', SQLERRM;
    RETURN new;
  END;

  -- 记录积分交易
  BEGIN
    PERFORM record_point_transaction(
      new.id,
      v_register_points,
      'registration',
      '注册赠送积分 +' || v_register_points || '积分',
      NULL,
      NULL,
      jsonb_build_object('source', 'registration')
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Failed to record points: %', SQLERRM;
  END;

  -- 发送欢迎通知
  BEGIN
    PERFORM create_notification(
      new.id,
      'system',
      'registration',
      '欢迎加入',
      '注册成功！您已获得 ' || v_register_points || ' 积分奖励，快去体验吧！',
      NULL,
      NULL,
      jsonb_build_object('points', v_register_points),
      'normal',
      NULL
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Failed to send notification: %', SQLERRM;
  END;

  RETURN new;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Unexpected error in handle_new_user: %', SQLERRM;
  RETURN new;
END;
$$;

-- 步骤 2: 重新创建触发器
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 步骤 3: 更新注释
COMMENT ON FUNCTION public.handle_new_user IS '处理新用户注册：创建profile（含email）、积分、通知，支持前端注册和管理员创建';

-- 步骤 4: 验证触发器
SELECT
  trigger_name,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE event_object_schema = 'auth'
  AND event_object_table = 'users'
  AND trigger_name = 'on_auth_user_created';

-- ============================================================
-- 执行完成！
-- ============================================================
-- 关键修复:
-- 1. ✅ 触发器直接设置 email 字段，不依赖 sync_email_trigger
-- 2. ✅ 使用 ON CONFLICT DO UPDATE 处理重复插入
-- 3. ✅ 所有操作都有错误处理，不会中断用户创建
-- 4. ✅ 同时支持前端注册和管理员创建用户
-- ============================================================

SELECT '✅ 触发器已修复，现在前端注册和管理员创建都能正常工作了' as status;



-- =============================================
-- 文件: 062_add_sensitive_words_config.sql
-- =============================================

-- ============================================================
-- 添加敏感词过滤配置
-- ============================================================
-- 在 system_settings 表添加 sensitive_words 字段
-- 用于存储敏感词列表，用于过滤商家入驻申请的详情描述
-- ============================================================

-- 步骤 1: 添加 sensitive_words 字段（JSON 数组格式）
ALTER TABLE system_settings
ADD COLUMN IF NOT EXISTS sensitive_words JSONB DEFAULT '[]'::jsonb;

-- 步骤 2: 添加字段注释
COMMENT ON COLUMN system_settings.sensitive_words IS '敏感词列表（用于过滤商家入驻描述等内容）';

-- 步骤 3: 插入默认的敏感词（可选）
UPDATE system_settings
SET sensitive_words = '["微信", "QQ", "WeChat", "VX", "vx", "wx", "WX", "加我", "联系方式", "手机号", "电话", "网址", "http", "www", ".com", ".cn"]'::jsonb
WHERE id = '00000000-0000-0000-0000-000000000001'
AND sensitive_words = '[]'::jsonb;

-- 步骤 4: 验证字段是否添加成功
SELECT
  column_name,
  data_type,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'system_settings'
  AND column_name = 'sensitive_words';

-- 步骤 5: 查看当前配置
SELECT
  platform_name,
  sensitive_words
FROM system_settings
WHERE id = '00000000-0000-0000-0000-000000000001';

-- ============================================================
-- 执行完成！
-- ============================================================
-- 说明:
-- 1. ✅ 添加了 sensitive_words 字段（JSONB 类型，存储字符串数组）
-- 2. ✅ 设置了默认的常见敏感词
-- 3. ✅ 管理员可以在后台自由添加/删除敏感词
-- ============================================================

SELECT '✅ 敏感词配置字段已添加' as status;



-- =============================================
-- 文件: 063_create_merchant_notes.sql
-- =============================================

-- 创建商家备注表
CREATE TABLE IF NOT EXISTS merchant_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  note TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, merchant_id)
);

-- 添加索引
CREATE INDEX IF NOT EXISTS idx_merchant_notes_user_id ON merchant_notes(user_id);
CREATE INDEX IF NOT EXISTS idx_merchant_notes_merchant_id ON merchant_notes(merchant_id);

-- 添加注释
COMMENT ON TABLE merchant_notes IS '用户对商家的备注';
COMMENT ON COLUMN merchant_notes.user_id IS '用户ID';
COMMENT ON COLUMN merchant_notes.merchant_id IS '商家ID';
COMMENT ON COLUMN merchant_notes.note IS '备注内容';

-- RLS 策略
ALTER TABLE merchant_notes ENABLE ROW LEVEL SECURITY;

-- 用户只能查看自己的备注
CREATE POLICY "用户可以查看自己的备注"
  ON merchant_notes
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- 用户可以创建自己的备注
CREATE POLICY "用户可以创建备注"
  ON merchant_notes
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 用户可以更新自己的备注
CREATE POLICY "用户可以更新自己的备注"
  ON merchant_notes
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 用户可以删除自己的备注
CREATE POLICY "用户可以删除自己的备注"
  ON merchant_notes
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);



-- =============================================
-- 文件: 064_add_user_number.sql
-- =============================================

-- 添加用户编号字段(从1001开始)
-- Add user_number field to profiles table starting from 1001

-- 1. 创建序列,从1001开始
CREATE SEQUENCE IF NOT EXISTS user_number_seq START WITH 1001;

-- 2. 添加 user_number 字段(暂时允许NULL,用于更新现有用户)
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS user_number INTEGER UNIQUE;

-- 3. 为现有用户分配编号
DO $$
DECLARE
  profile_record RECORD;
  current_num INTEGER := 1001;
BEGIN
  -- 按创建时间顺序为现有用户分配编号
  FOR profile_record IN
    SELECT id FROM profiles
    WHERE user_number IS NULL
    ORDER BY created_at ASC
  LOOP
    UPDATE profiles
    SET user_number = current_num
    WHERE id = profile_record.id;

    current_num := current_num + 1;
  END LOOP;

  -- 更新序列的当前值为下一个可用编号
  PERFORM setval('user_number_seq', current_num);
END $$;

-- 4. 设置字段为NOT NULL(现在所有用户都有编号了)
ALTER TABLE profiles
ALTER COLUMN user_number SET NOT NULL;

-- 5. 更新用户创建触发器,自动分配编号
-- 先删除旧触发器(如果存在)
DROP TRIGGER IF EXISTS assign_user_number_on_insert ON profiles;

-- 创建触发器函数
CREATE OR REPLACE FUNCTION assign_user_number()
RETURNS TRIGGER AS $$
BEGIN
  -- 如果user_number为空,自动分配下一个编号
  IF NEW.user_number IS NULL THEN
    NEW.user_number := nextval('user_number_seq');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 创建触发器
CREATE TRIGGER assign_user_number_on_insert
BEFORE INSERT ON profiles
FOR EACH ROW
EXECUTE FUNCTION assign_user_number();

-- 6. 添加索引以优化搜索
CREATE INDEX IF NOT EXISTS idx_profiles_user_number ON profiles(user_number);

-- 完成提示
DO $$
BEGIN
  RAISE NOTICE '✅ 用户编号系统已成功创建!';
  RAISE NOTICE '✅ 现有用户已分配编号(从1001开始)';
  RAISE NOTICE '✅ 新用户将自动获得递增编号';
  RAISE NOTICE '✅ 索引已创建,支持快速搜索';
END $$;



-- =============================================
-- 文件: 065_add_reporter_contact_to_reports.sql
-- =============================================

-- 添加举报者联系方式字段到 reports 表
-- 执行日期: 2025-01-15

-- 添加 reporter_contact 字段
ALTER TABLE reports
ADD COLUMN IF NOT EXISTS reporter_contact TEXT;

-- 添加字段注释
COMMENT ON COLUMN reports.reporter_contact IS '举报者联系方式（微信、电话、Telegram等）';

-- 刷新 schema cache
NOTIFY pgrst, 'reload schema';



-- =============================================
-- 文件: 066_add_applicant_notes_to_partners.sql
-- =============================================

-- 添加申请人备注字段到 partners 表
-- 执行日期: 2025-01-15

-- 添加 applicant_notes 字段 (申请人填写的备注)
ALTER TABLE partners
ADD COLUMN IF NOT EXISTS applicant_notes TEXT;

-- 添加字段注释
COMMENT ON COLUMN partners.applicant_notes IS '申请人备注（申请时填写的备注信息）';

-- 刷新 schema cache
NOTIFY pgrst, 'reload schema';



-- =============================================
-- 文件: 067_add_subscription_unit_to_partners.sql
-- =============================================

-- 添加订阅单位字段到 partners 表
-- 执行日期: 2025-01-15

-- 添加 subscription_unit 字段 (订阅单位: month 或 year)
ALTER TABLE partners
ADD COLUMN IF NOT EXISTS subscription_unit VARCHAR(10) DEFAULT 'year';

-- 重命名 duration_years 为 duration_value (保留数值,但现在可以表示月或年)
-- 注意: 如果字段已经存在,可以跳过这一步
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'partners' AND column_name = 'duration_years'
  ) THEN
    ALTER TABLE partners RENAME COLUMN duration_years TO duration_value;
  END IF;
END $$;

-- 添加字段注释
COMMENT ON COLUMN partners.subscription_unit IS '订阅单位: month(按月) 或 year(按年)';
COMMENT ON COLUMN partners.duration_value IS '订阅时长数值(配合subscription_unit使用)';

-- 刷新 schema cache
NOTIFY pgrst, 'reload schema';



-- =============================================
-- 文件: 068_complete_subscription_fields.sql
-- =============================================

-- 完整添加订阅相关字段到 partners 表
-- 执行日期: 2025-01-15

-- 1. 添加 subscription_unit 字段 (订阅单位: month 或 year)
ALTER TABLE partners
ADD COLUMN IF NOT EXISTS subscription_unit VARCHAR(10) DEFAULT 'year';

-- 2. 添加或重命名 duration_value 字段
DO $$
BEGIN
  -- 如果 duration_years 存在,重命名为 duration_value
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'partners' AND column_name = 'duration_years'
  ) THEN
    ALTER TABLE partners RENAME COLUMN duration_years TO duration_value;
  -- 如果 duration_value 不存在,创建它
  ELSIF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'partners' AND column_name = 'duration_value'
  ) THEN
    ALTER TABLE partners ADD COLUMN duration_value INTEGER DEFAULT 1;
  END IF;
END $$;

-- 3. 添加 unit_fee 字段 (单价)
ALTER TABLE partners
ADD COLUMN IF NOT EXISTS unit_fee DECIMAL(10,2) DEFAULT 100;

-- 4. 添加 total_amount 字段 (总金额)
ALTER TABLE partners
ADD COLUMN IF NOT EXISTS total_amount DECIMAL(10,2) DEFAULT 100;

-- 5. 添加 payment_proof_url 字段 (支付凭证URL)
ALTER TABLE partners
ADD COLUMN IF NOT EXISTS payment_proof_url TEXT;

-- 6. 添加 transaction_hash 字段 (交易哈希/交易ID)
ALTER TABLE partners
ADD COLUMN IF NOT EXISTS transaction_hash TEXT;

-- 添加字段注释
COMMENT ON COLUMN partners.subscription_unit IS '订阅单位: month(按月) 或 year(按年)';
COMMENT ON COLUMN partners.duration_value IS '订阅时长数值(配合subscription_unit使用)';
COMMENT ON COLUMN partners.unit_fee IS '单价(USDT)';
COMMENT ON COLUMN partners.total_amount IS '总金额(USDT)';
COMMENT ON COLUMN partners.payment_proof_url IS '支付凭证图片URL';
COMMENT ON COLUMN partners.transaction_hash IS '交易哈希或交易ID';

-- 刷新 schema cache
NOTIFY pgrst, 'reload schema';



-- =============================================
-- 文件: 069_remove_total_amount_constraint.sql
-- =============================================

-- 删除 partners 表的 total_amount 约束
-- 执行日期: 2025-01-15

-- 删除 check_total_amount 约束(如果存在)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'check_total_amount'
    AND table_name = 'partners'
  ) THEN
    ALTER TABLE partners DROP CONSTRAINT check_total_amount;
    RAISE NOTICE 'Constraint check_total_amount dropped successfully';
  ELSE
    RAISE NOTICE 'Constraint check_total_amount does not exist';
  END IF;
END $$;

-- 刷新 schema cache
NOTIFY pgrst, 'reload schema';



-- =============================================
-- 文件: 070_add_pin_type_to_merchants.sql
-- =============================================

-- 为商家表添加置顶类型字段
-- 执行日期: 2025-01-15

-- 1. 添加 pin_type 字段 (置顶类型: null=未置顶, self=自助置顶, admin=官方置顶)
ALTER TABLE merchants
ADD COLUMN IF NOT EXISTS pin_type VARCHAR(10) DEFAULT NULL;

-- 2. 添加 pin_expires_at 字段 (自助置顶的到期时间)
-- 注意: 官方置顶没有到期时间,pin_expires_at 保持为 NULL
ALTER TABLE merchants
ADD COLUMN IF NOT EXISTS pin_expires_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- 3. 迁移现有数据: 将 is_topped = true 的商家迁移为自助置顶
-- 将现有的 topped_until 值复制到 pin_expires_at
UPDATE merchants
SET
  pin_type = 'self',
  pin_expires_at = topped_until
WHERE is_topped = true;

-- 4. 添加字段注释
COMMENT ON COLUMN merchants.pin_type IS '置顶类型: null(未置顶), self(自助置顶), admin(官方置顶)';
COMMENT ON COLUMN merchants.pin_expires_at IS '自助置顶的到期时间(官方置顶无到期时间)';

-- 5. 创建索引以优化排序查询
CREATE INDEX IF NOT EXISTS idx_merchants_pin_type ON merchants(pin_type);
CREATE INDEX IF NOT EXISTS idx_merchants_pin_expires_at ON merchants(pin_expires_at);

-- 6. 刷新 schema cache
NOTIFY pgrst, 'reload schema';



-- =============================================
-- 文件: 071_create_scheduled_point_transfers_table.sql
-- =============================================

-- 创建定时积分转账任务表
CREATE TABLE IF NOT EXISTS scheduled_point_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 创建者信息
  created_by UUID NOT NULL REFERENCES auth.users(id),

  -- 转账配置
  points INTEGER NOT NULL CHECK (points > 0),
  reason TEXT NOT NULL,
  target_role TEXT NOT NULL DEFAULT 'all' CHECK (target_role IN ('all', 'user', 'merchant')),

  -- 定时信息
  scheduled_at TIMESTAMPTZ NOT NULL,

  -- 执行状态
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'executing', 'completed', 'failed', 'cancelled')),
  executed_at TIMESTAMPTZ,

  -- 执行结果
  total_users INTEGER,
  success_count INTEGER,
  fail_count INTEGER,
  error_message TEXT,

  -- 时间戳
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 创建索引
CREATE INDEX idx_scheduled_point_transfers_status ON scheduled_point_transfers(status);
CREATE INDEX idx_scheduled_point_transfers_scheduled_at ON scheduled_point_transfers(scheduled_at);
CREATE INDEX idx_scheduled_point_transfers_created_by ON scheduled_point_transfers(created_by);

-- 添加注释
COMMENT ON TABLE scheduled_point_transfers IS '定时积分转账任务表';
COMMENT ON COLUMN scheduled_point_transfers.points IS '每个用户获得的积分数';
COMMENT ON COLUMN scheduled_point_transfers.reason IS '转账原因';
COMMENT ON COLUMN scheduled_point_transfers.target_role IS '目标用户角色: all-所有用户, user-普通用户, merchant-商家用户';
COMMENT ON COLUMN scheduled_point_transfers.scheduled_at IS '计划执行时间';
COMMENT ON COLUMN scheduled_point_transfers.status IS '任务状态: pending-待执行, executing-执行中, completed-已完成, failed-失败, cancelled-已取消';

-- 添加 RLS 策略
ALTER TABLE scheduled_point_transfers ENABLE ROW LEVEL SECURITY;

-- 管理员可以查看所有任务
CREATE POLICY "管理员可以查看所有定时转账任务"
  ON scheduled_point_transfers
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- 管理员可以创建任务
CREATE POLICY "管理员可以创建定时转账任务"
  ON scheduled_point_transfers
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- 管理员可以更新任务
CREATE POLICY "管理员可以更新定时转账任务"
  ON scheduled_point_transfers
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- 管理员可以删除任务
CREATE POLICY "管理员可以删除定时转账任务"
  ON scheduled_point_transfers
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- 创建执行定时转账任务的函数
CREATE OR REPLACE FUNCTION execute_scheduled_point_transfers()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  task_record RECORD;
  target_users RECORD;
  success_cnt INTEGER := 0;
  fail_cnt INTEGER := 0;
  total_cnt INTEGER := 0;
BEGIN
  -- 获取所有待执行的任务（scheduled_at 已到且状态为 pending）
  FOR task_record IN
    SELECT *
    FROM scheduled_point_transfers
    WHERE status = 'pending'
    AND scheduled_at <= now()
    ORDER BY scheduled_at ASC
  LOOP
    BEGIN
      -- 更新任务状态为执行中
      UPDATE scheduled_point_transfers
      SET status = 'executing',
          updated_at = now()
      WHERE id = task_record.id;

      -- 根据目标角色获取用户列表
      FOR target_users IN
        SELECT p.id, p.points, p.username
        FROM profiles p
        WHERE p.is_banned = false
        AND p.role != 'admin'
        AND (
          task_record.target_role = 'all'
          OR (task_record.target_role = 'user' AND p.role = 'user')
          OR (task_record.target_role = 'merchant' AND EXISTS (
            SELECT 1 FROM merchants m WHERE m.user_id = p.id
          ))
        )
      LOOP
        BEGIN
          total_cnt := total_cnt + 1;

          -- 更新用户积分
          UPDATE profiles
          SET points = points + task_record.points,
              updated_at = now()
          WHERE id = target_users.id;

          -- 创建通知
          INSERT INTO notifications (user_id, type, category, title, content, priority)
          VALUES (
            target_users.id,
            'points_reward',
            'system',
            '积分奖励',
            format('您获得了 %s 积分。原因：%s（活动日期：%s）。当前积分：%s',
              task_record.points,
              task_record.reason,
              to_char(task_record.scheduled_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Shanghai', 'YYYY年FMMM月FMDD日 HH24:MI'),
              target_users.points + task_record.points
            ),
            'normal'
          );

          success_cnt := success_cnt + 1;
        EXCEPTION
          WHEN OTHERS THEN
            fail_cnt := fail_cnt + 1;
            RAISE WARNING '给用户 % 转账失败: %', target_users.id, SQLERRM;
        END;
      END LOOP;

      -- 更新任务状态为已完成
      UPDATE scheduled_point_transfers
      SET status = 'completed',
          executed_at = now(),
          total_users = total_cnt,
          success_count = success_cnt,
          fail_count = fail_cnt,
          updated_at = now()
      WHERE id = task_record.id;

      -- 重置计数器
      success_cnt := 0;
      fail_cnt := 0;
      total_cnt := 0;

    EXCEPTION
      WHEN OTHERS THEN
        -- 任务执行失败
        UPDATE scheduled_point_transfers
        SET status = 'failed',
            executed_at = now(),
            error_message = SQLERRM,
            updated_at = now()
        WHERE id = task_record.id;

        RAISE WARNING '定时转账任务 % 执行失败: %', task_record.id, SQLERRM;
    END;
  END LOOP;
END;
$$;

-- 创建定时任务（每分钟检查一次）
-- 注意：需要先启用 pg_cron 扩展
SELECT cron.schedule(
  'execute-scheduled-point-transfers',
  '* * * * *', -- 每分钟执行一次
  'SELECT execute_scheduled_point_transfers();'
);

COMMENT ON FUNCTION execute_scheduled_point_transfers IS '执行定时积分转账任务';



-- =============================================
-- 文件: 072_fix_scheduled_transfers_timezone.sql
-- =============================================

-- 修复定时转账通知中的时区显示问题
-- 将 scheduled_at 从 UTC 转换为中国时区 (Asia/Shanghai, UTC+8)

-- 删除旧函数
DROP FUNCTION IF EXISTS execute_scheduled_point_transfers();

-- 重新创建执行定时转账任务的函数（修复时区问题）
CREATE OR REPLACE FUNCTION execute_scheduled_point_transfers()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  task_record RECORD;
  target_users RECORD;
  success_cnt INTEGER := 0;
  fail_cnt INTEGER := 0;
  total_cnt INTEGER := 0;
BEGIN
  -- 获取所有待执行的任务（scheduled_at 已到且状态为 pending）
  FOR task_record IN
    SELECT *
    FROM scheduled_point_transfers
    WHERE status = 'pending'
    AND scheduled_at <= now()
    ORDER BY scheduled_at ASC
  LOOP
    BEGIN
      -- 更新任务状态为执行中
      UPDATE scheduled_point_transfers
      SET status = 'executing',
          updated_at = now()
      WHERE id = task_record.id;

      -- 根据目标角色获取用户列表
      FOR target_users IN
        SELECT p.id, p.points, p.username
        FROM profiles p
        WHERE p.is_banned = false
        AND p.role != 'admin'
        AND (
          task_record.target_role = 'all'
          OR (task_record.target_role = 'user' AND p.role = 'user')
          OR (task_record.target_role = 'merchant' AND EXISTS (
            SELECT 1 FROM merchants m WHERE m.user_id = p.id
          ))
        )
      LOOP
        BEGIN
          total_cnt := total_cnt + 1;

          -- 更新用户积分
          UPDATE profiles
          SET points = points + task_record.points,
              updated_at = now()
          WHERE id = target_users.id;

          -- 创建通知（时区修正：UTC -> Asia/Shanghai）
          INSERT INTO notifications (user_id, type, category, title, content, priority)
          VALUES (
            target_users.id,
            'points_reward',
            'system',
            '积分奖励',
            format('您获得了 %s 积分。原因：%s（活动日期：%s）。当前积分：%s',
              task_record.points,
              task_record.reason,
              to_char(task_record.scheduled_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Shanghai', 'YYYY年FMMM月FMDD日 HH24:MI'),
              target_users.points + task_record.points
            ),
            'normal'
          );

          success_cnt := success_cnt + 1;
        EXCEPTION
          WHEN OTHERS THEN
            fail_cnt := fail_cnt + 1;
            RAISE WARNING '给用户 % 转账失败: %', target_users.id, SQLERRM;
        END;
      END LOOP;

      -- 更新任务状态为已完成
      UPDATE scheduled_point_transfers
      SET status = 'completed',
          executed_at = now(),
          total_users = total_cnt,
          success_count = success_cnt,
          fail_count = fail_cnt,
          updated_at = now()
      WHERE id = task_record.id;

      -- 重置计数器
      success_cnt := 0;
      fail_cnt := 0;
      total_cnt := 0;

    EXCEPTION
      WHEN OTHERS THEN
        -- 任务执行失败
        UPDATE scheduled_point_transfers
        SET status = 'failed',
            executed_at = now(),
            error_message = SQLERRM,
            updated_at = now()
        WHERE id = task_record.id;

        RAISE WARNING '定时转账任务 % 执行失败: %', task_record.id, SQLERRM;
    END;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION execute_scheduled_point_transfers IS '执行定时积分转账任务（已修复时区显示问题）';



-- =============================================
-- 文件: 073_final_fix_scheduled_transfers_timezone.sql
-- =============================================

-- 最终修复：定时转账通知中的时区显示问题
-- 确保通知中显示的是中国时区时间 (Asia/Shanghai, UTC+8)

-- 删除旧函数
DROP FUNCTION IF EXISTS execute_scheduled_point_transfers();

-- 重新创建执行定时转账任务的函数（完整版，已修复时区）
CREATE OR REPLACE FUNCTION execute_scheduled_point_transfers()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  task_record RECORD;
  target_users RECORD;
  success_cnt INTEGER := 0;
  fail_cnt INTEGER := 0;
  total_cnt INTEGER := 0;
  formatted_date TEXT;
BEGIN
  -- 获取所有待执行的任务（scheduled_at 已到且状态为 pending）
  FOR task_record IN
    SELECT *
    FROM scheduled_point_transfers
    WHERE status = 'pending'
    AND scheduled_at <= now()
    ORDER BY scheduled_at ASC
  LOOP
    BEGIN
      -- 预先格式化日期（转换为中国时区）
      formatted_date := to_char(
        task_record.scheduled_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Shanghai',
        'YYYY年FMMM月FMDD日 HH24:MI'
      );

      -- 更新任务状态为执行中
      UPDATE scheduled_point_transfers
      SET status = 'executing',
          updated_at = now()
      WHERE id = task_record.id;

      -- 根据目标角色获取用户列表
      FOR target_users IN
        SELECT p.id, p.points, p.username
        FROM profiles p
        WHERE p.is_banned = false
        AND p.role != 'admin'
        AND (
          task_record.target_role = 'all'
          OR (task_record.target_role = 'user' AND p.role = 'user')
          OR (task_record.target_role = 'merchant' AND EXISTS (
            SELECT 1 FROM merchants m WHERE m.user_id = p.id
          ))
        )
      LOOP
        BEGIN
          total_cnt := total_cnt + 1;

          -- 计算新积分
          DECLARE
            new_points INTEGER;
          BEGIN
            new_points := (COALESCE(target_users.points, 0) + task_record.points);

            -- 更新用户积分
            UPDATE profiles
            SET points = new_points,
                updated_at = now()
            WHERE id = target_users.id;

            -- 创建通知（使用预先格式化的中国时区日期）
            INSERT INTO notifications (user_id, type, category, title, content, priority)
            VALUES (
              target_users.id,
              'points_reward',
              'system',
              '积分奖励',
              format('您获得了 %s 积分。原因：%s（活动日期：%s）。当前积分：%s',
                task_record.points,
                task_record.reason,
                formatted_date,
                new_points
              ),
              'normal'
            );
          END;

          success_cnt := success_cnt + 1;
        EXCEPTION
          WHEN OTHERS THEN
            fail_cnt := fail_cnt + 1;
            RAISE WARNING '给用户 % 转账失败: %', target_users.id, SQLERRM;
        END;
      END LOOP;

      -- 更新任务状态为已完成
      UPDATE scheduled_point_transfers
      SET status = 'completed',
          executed_at = now(),
          total_users = total_cnt,
          success_count = success_cnt,
          fail_count = fail_cnt,
          updated_at = now()
      WHERE id = task_record.id;

      -- 重置计数器
      success_cnt := 0;
      fail_cnt := 0;
      total_cnt := 0;

    EXCEPTION
      WHEN OTHERS THEN
        -- 任务执行失败
        UPDATE scheduled_point_transfers
        SET status = 'failed',
            executed_at = now(),
            error_message = SQLERRM,
            updated_at = now()
        WHERE id = task_record.id;

        RAISE WARNING '定时转账任务 % 执行失败: %', task_record.id, SQLERRM;
    END;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION execute_scheduled_point_transfers IS '执行定时积分转账任务（已完整修复时区显示问题）';

-- 测试时区转换是否正常工作
DO $$
BEGIN
  RAISE NOTICE '当前UTC时间: %', now();
  RAISE NOTICE '转换为中国时区: %', to_char(now() AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Shanghai', 'YYYY年FMMM月FMDD日 HH24:MI');
END $$;



-- =============================================
-- 文件: 074_verify_and_fix_timezone.sql
-- =============================================

-- ========================================
-- 验证并修复定时转账时区问题
-- 执行此脚本前后请检查输出
-- ========================================

-- 第一步：显示当前时区设置
DO $$
BEGIN
  RAISE NOTICE '=== 当前数据库时区设置 ===';
  RAISE NOTICE 'SHOW timezone: %', current_setting('timezone');
  RAISE NOTICE '当前时间(now()): %', now();
  RAISE NOTICE '当前时间转中国时区: %', now() AT TIME ZONE 'Asia/Shanghai';
END $$;

-- 第二步：测试时区转换
DO $$
DECLARE
  test_utc TIMESTAMPTZ := '2025-11-15 03:31:00+00'::timestamptz;
  test_china TEXT;
BEGIN
  RAISE NOTICE '=== 时区转换测试 ===';
  RAISE NOTICE 'UTC时间: %', test_utc;

  test_china := to_char(
    test_utc AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Shanghai',
    'YYYY年FMMM月FMDD日 HH24:MI'
  );

  RAISE NOTICE '转换为中国时区: %', test_china;
  RAISE NOTICE '预期结果: 2025年11月15日 11:31 (UTC+8小时)';
END $$;

-- 第三步：强制删除旧函数
DROP FUNCTION IF EXISTS execute_scheduled_point_transfers() CASCADE;

-- 第四步：创建新函数（使用完全固定的时区转换）
CREATE OR REPLACE FUNCTION execute_scheduled_point_transfers()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  task_record RECORD;
  target_users RECORD;
  success_cnt INTEGER := 0;
  fail_cnt INTEGER := 0;
  total_cnt INTEGER := 0;
  formatted_date TEXT;
BEGIN
  -- 获取所有待执行的任务
  FOR task_record IN
    SELECT *
    FROM scheduled_point_transfers
    WHERE status = 'pending'
    AND scheduled_at <= now()
    ORDER BY scheduled_at ASC
  LOOP
    BEGIN
      -- ★★★ 关键：预先格式化日期，转换为中国时区 ★★★
      formatted_date := to_char(
        task_record.scheduled_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Shanghai',
        'YYYY年FMMM月FMDD日 HH24:MI'
      );

      -- 更新任务状态为执行中
      UPDATE scheduled_point_transfers
      SET status = 'executing',
          updated_at = now()
      WHERE id = task_record.id;

      -- 根据目标角色获取用户列表
      FOR target_users IN
        SELECT p.id, p.points, p.username
        FROM profiles p
        WHERE p.is_banned = false
        AND p.role != 'admin'
        AND (
          task_record.target_role = 'all'
          OR (task_record.target_role = 'user' AND p.role = 'user')
          OR (task_record.target_role = 'merchant' AND EXISTS (
            SELECT 1 FROM merchants m WHERE m.user_id = p.id
          ))
        )
      LOOP
        BEGIN
          total_cnt := total_cnt + 1;

          -- 计算新积分
          DECLARE
            new_points INTEGER;
          BEGIN
            new_points := (COALESCE(target_users.points, 0) + task_record.points);

            -- 更新用户积分
            UPDATE profiles
            SET points = new_points,
                updated_at = now()
            WHERE id = target_users.id;

            -- ★★★ 创建通知（使用预先格式化的中国时区日期）★★★
            INSERT INTO notifications (user_id, type, category, title, content, priority)
            VALUES (
              target_users.id,
              'points_reward',
              'system',
              '积分奖励',
              format('您获得了 %s 积分。原因：%s（活动日期：%s）。当前积分：%s',
                task_record.points,
                task_record.reason,
                formatted_date,  -- 使用预先格式化的中国时区日期
                new_points
              ),
              'normal'
            );
          END;

          success_cnt := success_cnt + 1;
        EXCEPTION
          WHEN OTHERS THEN
            fail_cnt := fail_cnt + 1;
            RAISE WARNING '给用户 % 转账失败: %', target_users.id, SQLERRM;
        END;
      END LOOP;

      -- 更新任务状态为已完成
      UPDATE scheduled_point_transfers
      SET status = 'completed',
          executed_at = now(),
          total_users = total_cnt,
          success_count = success_cnt,
          fail_count = fail_cnt,
          updated_at = now()
      WHERE id = task_record.id;

      -- 重置计数器
      success_cnt := 0;
      fail_cnt := 0;
      total_cnt := 0;

    EXCEPTION
      WHEN OTHERS THEN
        -- 任务执行失败
        UPDATE scheduled_point_transfers
        SET status = 'failed',
            executed_at = now(),
            error_message = SQLERRM,
            updated_at = now()
        WHERE id = task_record.id;

        RAISE WARNING '定时转账任务 % 执行失败: %', task_record.id, SQLERRM;
    END;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION execute_scheduled_point_transfers IS '执行定时积分转账任务（UTC时间转中国时区）';

-- 第五步：验证函数已更新
DO $$
BEGIN
  RAISE NOTICE '=== 函数更新完成 ===';
  RAISE NOTICE '函数名: execute_scheduled_point_transfers';
  RAISE NOTICE '请检查上面的时区转换测试结果';
  RAISE NOTICE '如果测试显示 11:31（而不是 03:31），说明时区转换正常';
END $$;



-- =============================================
-- 文件: 075_fix_timezone_with_offset.sql
-- =============================================

-- ========================================
-- 使用数字偏移量修复时区问题
-- 不使用 'Asia/Shanghai'，改用 '+08' 偏移量
-- ========================================

-- 第一步：测试数字偏移量方式
DO $$
DECLARE
  test_utc TIMESTAMPTZ := '2025-11-15 03:31:00+00'::timestamptz;
  test_china_name TEXT;
  test_china_offset TEXT;
BEGIN
  RAISE NOTICE '=== 时区转换对比测试 ===';
  RAISE NOTICE 'UTC时间: %', test_utc;

  -- 尝试使用时区名称（可能不支持）
  BEGIN
    test_china_name := to_char(
      test_utc AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Shanghai',
      'YYYY年FMMM月FMDD日 HH24:MI'
    );
    RAISE NOTICE '使用 Asia/Shanghai: %', test_china_name;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '使用 Asia/Shanghai: 失败 - %', SQLERRM;
  END;

  -- 使用数字偏移量（通用方式）
  test_china_offset := to_char(
    test_utc AT TIME ZONE 'UTC' AT TIME ZONE '+08',
    'YYYY年FMMM月FMDD日 HH24:MI'
  );
  RAISE NOTICE '使用 +08 偏移: %', test_china_offset;
  RAISE NOTICE '预期结果: 2025年11月15日 11:31';
  RAISE NOTICE '';
END $$;

-- 第二步：强制删除旧函数
DROP FUNCTION IF EXISTS execute_scheduled_point_transfers() CASCADE;

-- 第三步：创建新函数（使用 +08 偏移量）
CREATE OR REPLACE FUNCTION execute_scheduled_point_transfers()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  task_record RECORD;
  target_users RECORD;
  success_cnt INTEGER := 0;
  fail_cnt INTEGER := 0;
  total_cnt INTEGER := 0;
  formatted_date TEXT;
BEGIN
  -- 获取所有待执行的任务
  FOR task_record IN
    SELECT *
    FROM scheduled_point_transfers
    WHERE status = 'pending'
    AND scheduled_at <= now()
    ORDER BY scheduled_at ASC
  LOOP
    BEGIN
      -- ★★★ 使用 +08 偏移量代替 Asia/Shanghai ★★★
      formatted_date := to_char(
        task_record.scheduled_at AT TIME ZONE 'UTC' AT TIME ZONE '+08',
        'YYYY年FMMM月FMDD日 HH24:MI'
      );

      -- 更新任务状态为执行中
      UPDATE scheduled_point_transfers
      SET status = 'executing',
          updated_at = now()
      WHERE id = task_record.id;

      -- 根据目标角色获取用户列表
      FOR target_users IN
        SELECT p.id, p.points, p.username
        FROM profiles p
        WHERE p.is_banned = false
        AND p.role != 'admin'
        AND (
          task_record.target_role = 'all'
          OR (task_record.target_role = 'user' AND p.role = 'user')
          OR (task_record.target_role = 'merchant' AND EXISTS (
            SELECT 1 FROM merchants m WHERE m.user_id = p.id
          ))
        )
      LOOP
        BEGIN
          total_cnt := total_cnt + 1;

          -- 计算新积分
          DECLARE
            new_points INTEGER;
          BEGIN
            new_points := (COALESCE(target_users.points, 0) + task_record.points);

            -- 更新用户积分
            UPDATE profiles
            SET points = new_points,
                updated_at = now()
            WHERE id = target_users.id;

            -- 创建通知（使用 +08 时区格式化的日期）
            INSERT INTO notifications (user_id, type, category, title, content, priority)
            VALUES (
              target_users.id,
              'points_reward',
              'system',
              '积分奖励',
              format('您获得了 %s 积分。原因：%s（活动日期：%s）。当前积分：%s',
                task_record.points,
                task_record.reason,
                formatted_date,  -- 使用 +08 偏移量格式化的日期
                new_points
              ),
              'normal'
            );
          END;

          success_cnt := success_cnt + 1;
        EXCEPTION
          WHEN OTHERS THEN
            fail_cnt := fail_cnt + 1;
            RAISE WARNING '给用户 % 转账失败: %', target_users.id, SQLERRM;
        END;
      END LOOP;

      -- 更新任务状态为已完成
      UPDATE scheduled_point_transfers
      SET status = 'completed',
          executed_at = now(),
          total_users = total_cnt,
          success_count = success_cnt,
          fail_count = fail_cnt,
          updated_at = now()
      WHERE id = task_record.id;

      -- 重置计数器
      success_cnt := 0;
      fail_cnt := 0;
      total_cnt := 0;

    EXCEPTION
      WHEN OTHERS THEN
        -- 任务执行失败
        UPDATE scheduled_point_transfers
        SET status = 'failed',
            executed_at = now(),
            error_message = SQLERRM,
            updated_at = now()
        WHERE id = task_record.id;

        RAISE WARNING '定时转账任务 % 执行失败: %', task_record.id, SQLERRM;
    END;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION execute_scheduled_point_transfers IS '执行定时积分转账任务（使用+08偏移量转中国时区）';

-- 第四步：验证
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== 修复完成 ===';
  RAISE NOTICE '已使用 +08 偏移量代替 Asia/Shanghai';
  RAISE NOTICE '请检查上面的测试结果是否显示 11:31';
  RAISE NOTICE '如果显示正确，说明修复成功';
END $$;



-- =============================================
-- 文件: 076_add_point_transactions_to_scheduled_transfers.sql
-- =============================================

-- ========================================
-- 修复定时转账：添加积分交易记录
-- ========================================

-- 强制删除旧函数
DROP FUNCTION IF EXISTS execute_scheduled_point_transfers() CASCADE;

-- 创建新函数（添加积分交易记录）
CREATE OR REPLACE FUNCTION execute_scheduled_point_transfers()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  task_record RECORD;
  target_users RECORD;
  success_cnt INTEGER := 0;
  fail_cnt INTEGER := 0;
  total_cnt INTEGER := 0;
  formatted_date TEXT;
BEGIN
  -- 获取所有待执行的任务
  FOR task_record IN
    SELECT *
    FROM scheduled_point_transfers
    WHERE status = 'pending'
    AND scheduled_at <= now()
    ORDER BY scheduled_at ASC
  LOOP
    BEGIN
      -- 使用 +08 偏移量代替 Asia/Shanghai
      formatted_date := to_char(
        task_record.scheduled_at AT TIME ZONE 'UTC' AT TIME ZONE '+08',
        'YYYY年FMMM月FMDD日 HH24:MI'
      );

      -- 更新任务状态为执行中
      UPDATE scheduled_point_transfers
      SET status = 'executing',
          updated_at = now()
      WHERE id = task_record.id;

      -- 根据目标角色获取用户列表
      FOR target_users IN
        SELECT p.id, p.points, p.username
        FROM profiles p
        WHERE p.is_banned = false
        AND p.role != 'admin'
        AND (
          task_record.target_role = 'all'
          OR (task_record.target_role = 'user' AND p.role = 'user')
          OR (task_record.target_role = 'merchant' AND EXISTS (
            SELECT 1 FROM merchants m WHERE m.user_id = p.id
          ))
        )
      LOOP
        BEGIN
          total_cnt := total_cnt + 1;

          -- 计算新积分
          DECLARE
            new_points INTEGER;
          BEGIN
            new_points := (COALESCE(target_users.points, 0) + task_record.points);

            -- 更新用户积分
            UPDATE profiles
            SET points = new_points,
                updated_at = now()
            WHERE id = target_users.id;

            -- ★★★ 新增：创建积分交易记录 ★★★
            INSERT INTO point_transactions (user_id, amount, balance_after, type, description)
            VALUES (
              target_users.id,
              task_record.points,
              new_points,
              'points_reward',
              format('%s（活动日期：%s）', task_record.reason, formatted_date)
            );

            -- 创建通知（使用 +08 时区格式化的日期）
            INSERT INTO notifications (user_id, type, category, title, content, priority)
            VALUES (
              target_users.id,
              'points_reward',
              'system',
              '积分奖励',
              format('您获得了 %s 积分。原因：%s（活动日期：%s）。当前积分：%s',
                task_record.points,
                task_record.reason,
                formatted_date,
                new_points
              ),
              'normal'
            );
          END;

          success_cnt := success_cnt + 1;
        EXCEPTION
          WHEN OTHERS THEN
            fail_cnt := fail_cnt + 1;
            RAISE WARNING '给用户 % 转账失败: %', target_users.id, SQLERRM;
        END;
      END LOOP;

      -- 更新任务状态为已完成
      UPDATE scheduled_point_transfers
      SET status = 'completed',
          executed_at = now(),
          total_users = total_cnt,
          success_count = success_cnt,
          fail_count = fail_cnt,
          updated_at = now()
      WHERE id = task_record.id;

      -- 重置计数器
      success_cnt := 0;
      fail_cnt := 0;
      total_cnt := 0;

    EXCEPTION
      WHEN OTHERS THEN
        -- 任务执行失败
        UPDATE scheduled_point_transfers
        SET status = 'failed',
            executed_at = now(),
            error_message = SQLERRM,
            updated_at = now()
        WHERE id = task_record.id;

        RAISE WARNING '定时转账任务 % 执行失败: %', task_record.id, SQLERRM;
    END;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION execute_scheduled_point_transfers IS '执行定时积分转账任务（已添加积分交易记录）';

-- 验证
DO $$
BEGIN
  RAISE NOTICE '=== 修复完成 ===';
  RAISE NOTICE '已添加积分交易记录功能';
  RAISE NOTICE '现在定时转账会在 point_transactions 表中创建记录';
END $$;



-- =============================================
-- 文件: 077_add_merchants_per_page_setting.sql
-- =============================================

-- 添加商家列表每页显示数量配置
ALTER TABLE system_settings
ADD COLUMN IF NOT EXISTS merchants_per_page INTEGER DEFAULT 20 CHECK (merchants_per_page > 0 AND merchants_per_page <= 100);

COMMENT ON COLUMN system_settings.merchants_per_page IS '首页商家列表每页显示数量(1-100)';

-- 更新现有记录
UPDATE system_settings
SET merchants_per_page = 20
WHERE merchants_per_page IS NULL;



-- =============================================
-- 文件: 078_add_coin_exchange_url_setting.sql
-- =============================================

-- 添加积分兑换外链配置
ALTER TABLE system_settings
ADD COLUMN IF NOT EXISTS coin_exchange_url TEXT DEFAULT NULL;

COMMENT ON COLUMN system_settings.coin_exchange_url IS '积分兑换外链地址（如果为空则跳转帮助中心）';

-- 更新现有记录（默认为空，保持原有跳转帮助中心的行为）
UPDATE system_settings
SET coin_exchange_url = NULL
WHERE coin_exchange_url IS NULL;



-- =============================================
-- 文件: 079_add_low_points_threshold_setting.sql
-- =============================================

-- 添加积分不足预警阈值配置
ALTER TABLE system_settings
ADD COLUMN IF NOT EXISTS low_points_threshold INTEGER DEFAULT 100 CHECK (low_points_threshold >= 0 AND low_points_threshold <= 1000);

COMMENT ON COLUMN system_settings.low_points_threshold IS '积分不足预警阈值（当用户积分低于此值时发送通知）';

-- 更新现有记录
UPDATE system_settings
SET low_points_threshold = 100
WHERE low_points_threshold IS NULL;



-- =============================================
-- 文件: 080_create_platform_income_table.sql
-- =============================================

-- 创建平台收入记录表
CREATE TABLE IF NOT EXISTS platform_income (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 收入类型（只有两种）
  income_type VARCHAR(50) NOT NULL CHECK (income_type IN ('deposit_fee', 'partner_subscription')),

  -- 金额（USDT）
  amount DECIMAL(10, 2) NOT NULL CHECK (amount >= 0),

  -- 关联信息
  merchant_id UUID REFERENCES merchants(id) ON DELETE SET NULL, -- 如果是押金手续费，关联商家
  partner_id UUID REFERENCES partners(id) ON DELETE SET NULL, -- 如果是合作伙伴，关联合作伙伴
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- 付款的用户

  -- 详细说明
  description TEXT NOT NULL,

  -- 额外信息（JSON格式，存储详细数据）
  details JSONB,

  -- 时间
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  income_date DATE DEFAULT CURRENT_DATE, -- 收入日期（便于统计）

  -- 备注（管理员可以添加）
  admin_note TEXT
);

-- 创建索引以提升查询性能
CREATE INDEX idx_platform_income_type ON platform_income(income_type);
CREATE INDEX idx_platform_income_date ON platform_income(income_date DESC);
CREATE INDEX idx_platform_income_merchant ON platform_income(merchant_id) WHERE merchant_id IS NOT NULL;
CREATE INDEX idx_platform_income_partner ON platform_income(partner_id) WHERE partner_id IS NOT NULL;
CREATE INDEX idx_platform_income_created_at ON platform_income(created_at DESC);

-- 添加表注释
COMMENT ON TABLE platform_income IS '平台收入记录表，记录押金手续费和合作伙伴订阅费';
COMMENT ON COLUMN platform_income.income_type IS '收入类型：deposit_fee（押金手续费）或 partner_subscription（合作伙伴订阅）';
COMMENT ON COLUMN platform_income.amount IS '收入金额（USDT）';
COMMENT ON COLUMN platform_income.details IS 'JSON格式的详细信息，包含原始押金、手续费率、订阅时长等';
COMMENT ON COLUMN platform_income.income_date IS '收入日期，用于按日期统计';



-- =============================================
-- 文件: 081_add_transaction_type_to_platform_income.sql
-- =============================================

-- 为 platform_income 表添加交易类型字段，支持收入和支出

-- 添加 transaction_type 字段（默认为 income 保持向后兼容）
ALTER TABLE platform_income
ADD COLUMN IF NOT EXISTS transaction_type VARCHAR(10) DEFAULT 'income'
CHECK (transaction_type IN ('income', 'expense'));

-- 添加 created_by 字段，记录创建记录的管理员（用于手动添加的支出）
ALTER TABLE platform_income
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- 更新表和字段注释
COMMENT ON TABLE platform_income IS '平台财务记录表，记录收入和支出';

COMMENT ON COLUMN platform_income.transaction_type IS '交易类型：income（收入）或 expense（支出）';

COMMENT ON COLUMN platform_income.income_type IS '
收入类型: deposit_fee（押金手续费）, partner_subscription（合作伙伴订阅）
支出类型: manual_expense（手动支出）, operational_cost（运营成本）, marketing_cost（推广费用）
';

COMMENT ON COLUMN platform_income.created_by IS '创建记录的管理员ID（仅用于手动添加的记录）';

-- 创建索引以提升查询性能
CREATE INDEX IF NOT EXISTS idx_platform_income_transaction_type
ON platform_income(transaction_type);

CREATE INDEX IF NOT EXISTS idx_platform_income_created_by
ON platform_income(created_by) WHERE created_by IS NOT NULL;



-- =============================================
-- 文件: 082_fix_transaction_type_constraint.sql
-- =============================================

-- 修复 platform_income 表的 transaction_type 字段约束

-- 先删除可能存在的旧约束
DO $$
BEGIN
    -- 尝试删除可能存在的约束（如果不存在会被忽略）
    EXECUTE 'ALTER TABLE platform_income DROP CONSTRAINT IF EXISTS platform_income_transaction_type_check';
EXCEPTION
    WHEN undefined_object THEN
        NULL;
END $$;

-- 如果字段不存在，先添加字段
ALTER TABLE platform_income
ADD COLUMN IF NOT EXISTS transaction_type VARCHAR(10) DEFAULT 'income';

-- 添加 created_by 字段（如果不存在）
ALTER TABLE platform_income
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- 添加 income_date 字段（如果不存在，用于记录收入日期）
ALTER TABLE platform_income
ADD COLUMN IF NOT EXISTS income_date DATE DEFAULT CURRENT_DATE;

-- 单独添加 CHECK 约束
ALTER TABLE platform_income
ADD CONSTRAINT platform_income_transaction_type_check
CHECK (transaction_type IN ('income', 'expense'));

-- 更新表和字段注释
COMMENT ON TABLE platform_income IS '平台财务记录表，记录收入和支出';

COMMENT ON COLUMN platform_income.transaction_type IS '交易类型：income（收入）或 expense（支出）';

COMMENT ON COLUMN platform_income.income_type IS '
收入类型: deposit_fee（押金手续费）, partner_subscription（合作伙伴订阅）
支出类型: manual_expense（手动支出）, operational_cost（运营成本）, marketing_cost（推广费用）
';

COMMENT ON COLUMN platform_income.created_by IS '创建记录的管理员ID（仅用于手动添加的记录）';

COMMENT ON COLUMN platform_income.income_date IS '收入/支出日期（用于按日期统计）';

-- 创建索引以提升查询性能
CREATE INDEX IF NOT EXISTS idx_platform_income_transaction_type
ON platform_income(transaction_type);

CREATE INDEX IF NOT EXISTS idx_platform_income_created_by
ON platform_income(created_by) WHERE created_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_platform_income_income_date
ON platform_income(income_date);

-- 为已有记录设置 income_date（如果为空）
UPDATE platform_income
SET income_date = created_at::date
WHERE income_date IS NULL;



-- =============================================
-- 文件: 083_fix_income_type_constraint.sql
-- =============================================

-- 修复 platform_income 表的 income_type 约束，使其支持支出类型

-- 删除旧的 income_type 约束
ALTER TABLE platform_income
DROP CONSTRAINT IF EXISTS platform_income_income_type_check;

-- 添加新的 income_type 约束，包含收入和支出类型
ALTER TABLE platform_income
ADD CONSTRAINT platform_income_income_type_check
CHECK (income_type IN (
  'deposit_fee',           -- 押金手续费（收入）
  'partner_subscription',  -- 合作伙伴订阅（收入）
  'manual_expense',        -- 手动支出（支出）
  'operational_cost',      -- 运营成本（支出）
  'marketing_cost'         -- 推广费用（支出）
));

-- 更新字段注释
COMMENT ON COLUMN platform_income.income_type IS '
收入类型: deposit_fee（押金手续费）, partner_subscription（合作伙伴订阅）
支出类型: manual_expense（手动支出）, operational_cost（运营成本）, marketing_cost（推广费用）
';

-- 验证修改
SELECT
  conname AS constraint_name,
  pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'platform_income'::regclass
  AND conname LIKE '%income_type%';



-- =============================================
-- 文件: 032.4_create_deposit_refund_safe.sql
-- =============================================

-- =============================================
-- 安全执行：创建押金退还申请表（跳过已存在的对象）
-- =============================================

-- 1. 先删除可能存在的旧索引
DROP INDEX IF EXISTS public.idx_deposit_refund_merchant;
DROP INDEX IF EXISTS public.idx_deposit_refund_user;
DROP INDEX IF EXISTS public.idx_deposit_refund_status;
DROP INDEX IF EXISTS public.idx_deposit_refund_created;

-- 2. 创建表（如果不存在）
CREATE TABLE IF NOT EXISTS public.deposit_refund_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 关联信息
  merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- 押金信息
  deposit_amount DECIMAL(10, 2) NOT NULL,
  deposit_paid_at TIMESTAMP WITH TIME ZONE NOT NULL,
  refund_amount DECIMAL(10, 2) NOT NULL,
  fee_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
  fee_rate DECIMAL(5, 2) NOT NULL,

  -- 申请信息
  application_status TEXT NOT NULL DEFAULT 'pending',
  reason TEXT,

  -- 收款信息
  wallet_address TEXT NOT NULL,
  wallet_network TEXT NOT NULL,

  -- 审核信息
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  review_note TEXT,
  rejected_reason TEXT,

  -- 处理信息
  processed_by UUID REFERENCES auth.users(id),
  processed_at TIMESTAMP WITH TIME ZONE,
  transaction_hash TEXT,
  transaction_proof_url TEXT,

  -- 完成信息
  completed_at TIMESTAMP WITH TIME ZONE,
  completion_note TEXT,

  -- 时间戳
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  -- 约束
  CONSTRAINT valid_status CHECK (application_status IN ('pending', 'approved', 'processing', 'completed', 'rejected')),
  CONSTRAINT valid_amounts CHECK (deposit_amount > 0 AND refund_amount >= 0 AND fee_amount >= 0),
  CONSTRAINT valid_fee_rate CHECK (fee_rate >= 0 AND fee_rate <= 100),
  CONSTRAINT valid_wallet_network CHECK (wallet_network IN ('TRC20', 'ERC20', 'BEP20'))
);

-- 3. 创建索引（删除旧的后重新创建）
CREATE INDEX idx_deposit_refund_merchant ON public.deposit_refund_applications(merchant_id);
CREATE INDEX idx_deposit_refund_user ON public.deposit_refund_applications(user_id);
CREATE INDEX idx_deposit_refund_status ON public.deposit_refund_applications(application_status);
CREATE INDEX idx_deposit_refund_created ON public.deposit_refund_applications(created_at DESC);

-- 4. 创建或替换更新时间触发器函数
CREATE OR REPLACE FUNCTION update_deposit_refund_applications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. 删除旧触发器（如果存在）并创建新的
DROP TRIGGER IF EXISTS trigger_update_deposit_refund_applications_updated_at ON public.deposit_refund_applications;

CREATE TRIGGER trigger_update_deposit_refund_applications_updated_at
  BEFORE UPDATE ON public.deposit_refund_applications
  FOR EACH ROW
  EXECUTE FUNCTION update_deposit_refund_applications_updated_at();

-- 6. 添加表注释
COMMENT ON TABLE public.deposit_refund_applications IS '押金退还申请表';
COMMENT ON COLUMN public.deposit_refund_applications.merchant_id IS '商家ID';
COMMENT ON COLUMN public.deposit_refund_applications.user_id IS '用户ID';
COMMENT ON COLUMN public.deposit_refund_applications.deposit_amount IS '原始押金金额';
COMMENT ON COLUMN public.deposit_refund_applications.deposit_paid_at IS '押金缴纳时间';
COMMENT ON COLUMN public.deposit_refund_applications.refund_amount IS '实际退还金额（扣除手续费后）';
COMMENT ON COLUMN public.deposit_refund_applications.fee_amount IS '手续费金额';
COMMENT ON COLUMN public.deposit_refund_applications.fee_rate IS '手续费率（百分比）';
COMMENT ON COLUMN public.deposit_refund_applications.application_status IS '申请状态';
COMMENT ON COLUMN public.deposit_refund_applications.reason IS '退还原因';
COMMENT ON COLUMN public.deposit_refund_applications.wallet_address IS 'USDT钱包地址';
COMMENT ON COLUMN public.deposit_refund_applications.wallet_network IS '网络类型';
COMMENT ON COLUMN public.deposit_refund_applications.transaction_hash IS '交易哈希';

-- 7. 启用 RLS
ALTER TABLE public.deposit_refund_applications ENABLE ROW LEVEL SECURITY;

-- 8. 删除旧策略（如果存在）
DROP POLICY IF EXISTS "商家可以查看自己的退还申请" ON public.deposit_refund_applications;
DROP POLICY IF EXISTS "商家可以创建自己的退还申请" ON public.deposit_refund_applications;
DROP POLICY IF EXISTS "商家可以更新pending状态的申请" ON public.deposit_refund_applications;
DROP POLICY IF EXISTS "管理员可以查看所有退还申请" ON public.deposit_refund_applications;
DROP POLICY IF EXISTS "管理员可以更新所有退还申请" ON public.deposit_refund_applications;

-- 9. 创建 RLS 策略
CREATE POLICY "商家可以查看自己的退还申请"
  ON public.deposit_refund_applications
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "商家可以创建自己的退还申请"
  ON public.deposit_refund_applications
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "商家可以更新pending状态的申请"
  ON public.deposit_refund_applications
  FOR UPDATE
  USING (auth.uid() = user_id AND application_status = 'pending');

CREATE POLICY "管理员可以查看所有退还申请"
  ON public.deposit_refund_applications
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "管理员可以更新所有退还申请"
  ON public.deposit_refund_applications
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- 10. 更新 merchants 表，添加退还相关字段
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'merchants'
    AND column_name = 'deposit_refund_requested_at'
  ) THEN
    ALTER TABLE public.merchants
    ADD COLUMN deposit_refund_requested_at TIMESTAMP WITH TIME ZONE;
    COMMENT ON COLUMN public.merchants.deposit_refund_requested_at IS '最后一次申请退还时间';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'merchants'
    AND column_name = 'deposit_refund_completed_at'
  ) THEN
    ALTER TABLE public.merchants
    ADD COLUMN deposit_refund_completed_at TIMESTAMP WITH TIME ZONE;
    COMMENT ON COLUMN public.merchants.deposit_refund_completed_at IS '退还完成时间';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'merchants'
    AND column_name = 'deposit_refund_status'
  ) THEN
    ALTER TABLE public.merchants
    ADD COLUMN deposit_refund_status TEXT;
    COMMENT ON COLUMN public.merchants.deposit_refund_status IS '退还状态（none/pending/completed）';
  END IF;
END $$;

-- =============================================
-- 脚本执行完成
-- =============================================

-- 验证表创建
SELECT
  'deposit_refund_applications table created/verified' as status,
  COUNT(*) as column_count
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'deposit_refund_applications';



-- =============================================
-- 文件: 032.5_fix_deposit_rls.sql
-- =============================================

-- 为 deposit_merchant_applications 表设置 RLS 策略
-- 让管理员可以查看所有申请,普通用户只能查看自己的申请

-- 首先确保 RLS 已启用
ALTER TABLE deposit_merchant_applications ENABLE ROW LEVEL SECURITY;

-- 删除可能存在的旧策略
DROP POLICY IF EXISTS "Users can view own applications" ON deposit_merchant_applications;
DROP POLICY IF EXISTS "Admins can view all applications" ON deposit_merchant_applications;
DROP POLICY IF EXISTS "Users can insert own applications" ON deposit_merchant_applications;
DROP POLICY IF EXISTS "Admins can update applications" ON deposit_merchant_applications;

-- 1. 用户可以查看自己的申请
CREATE POLICY "Users can view own applications"
ON deposit_merchant_applications
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- 2. 管理员可以查看所有申请
CREATE POLICY "Admins can view all applications"
ON deposit_merchant_applications
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('admin', 'super_admin')
  )
);

-- 3. 用户可以插入自己的申请
CREATE POLICY "Users can insert own applications"
ON deposit_merchant_applications
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- 4. 管理员可以更新任何申请(审核)
CREATE POLICY "Admins can update applications"
ON deposit_merchant_applications
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('admin', 'super_admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('admin', 'super_admin')
  )
);

-- 验证策略
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'deposit_merchant_applications';



-- =============================================
-- 文件: 032.6_fix_deposit_refund_rls.sql
-- =============================================

-- 为 deposit_refund_applications 表设置 RLS 策略
-- 让管理员可以查看所有退还申请,普通用户只能查看自己的申请

-- 首先确保 RLS 已启用
ALTER TABLE deposit_refund_applications ENABLE ROW LEVEL SECURITY;

-- 删除可能存在的旧策略
DROP POLICY IF EXISTS "Users can view own refund applications" ON deposit_refund_applications;
DROP POLICY IF EXISTS "Admins can view all refund applications" ON deposit_refund_applications;
DROP POLICY IF EXISTS "Users can insert own refund applications" ON deposit_refund_applications;
DROP POLICY IF EXISTS "Admins can update refund applications" ON deposit_refund_applications;

-- 1. 用户可以查看自己的退还申请
CREATE POLICY "Users can view own refund applications"
ON deposit_refund_applications
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- 2. 管理员可以查看所有退还申请
CREATE POLICY "Admins can view all refund applications"
ON deposit_refund_applications
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('admin', 'super_admin')
  )
);

-- 3. 用户可以插入自己的退还申请
CREATE POLICY "Users can insert own refund applications"
ON deposit_refund_applications
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- 4. 管理员可以更新任何退还申请(审核)
CREATE POLICY "Admins can update refund applications"
ON deposit_refund_applications
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('admin', 'super_admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('admin', 'super_admin')
  )
);

-- 验证策略
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'deposit_refund_applications';



-- =============================================
-- 文件: 032.7_add_admin_rls_policies_for_merchants.sql
-- =============================================

-- 添加管理员对商家表的 RLS 策略
-- 允许管理员查询、更新、删除所有商家

-- 1. 添加管理员可以更新所有商家的策略
CREATE POLICY "merchants_admin_update"
  ON public.merchants FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- 2. 添加管理员可以删除所有商家的策略
CREATE POLICY "merchants_admin_delete"
  ON public.merchants FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- 3. 添加管理员可以查看所有商家的策略（包括下架的）
DROP POLICY IF EXISTS "merchants_select_policy" ON public.merchants;

CREATE POLICY "merchants_select_policy"
  ON public.merchants FOR SELECT
  USING (
    is_active = true -- 所有人可以查看已上架的商家
    OR auth.uid() = user_id -- 商家可以查看自己的记录
    OR EXISTS ( -- 管理员可以查看所有商家
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- 验证策略
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE tablename = 'merchants'
ORDER BY policyname;




-- =============================================
-- 文件: 032.9_setup_storage_policies.sql
-- =============================================

-- ====================================================================
-- Supabase Storage 策略配置
-- 用途: 为 public 存储桶设置 RLS 策略,允许已认证用户上传合作伙伴 Logo
-- ====================================================================

-- 首先删除可能存在的旧策略(如果不存在会报错,但不影响后续执行)
DROP POLICY IF EXISTS "允许已认证用户上传合作伙伴 Logo" ON storage.objects;
DROP POLICY IF EXISTS "允许所有人查看 public 存储桶文件" ON storage.objects;
DROP POLICY IF EXISTS "允许用户更新自己上传的文件" ON storage.objects;
DROP POLICY IF EXISTS "允许管理员删除文件" ON storage.objects;

-- 2. 创建策略: 允许已认证用户上传到 partner-logos 文件夹
CREATE POLICY "允许已认证用户上传合作伙伴 Logo"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'public'
  AND (storage.foldername(name))[1] = 'partner-logos'
);

-- 3. 创建策略: 允许所有人查看 public 存储桶中的文件
CREATE POLICY "允许所有人查看 public 存储桶文件"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'public');

-- 4. 创建策略: 允许已认证用户更新自己上传的文件
CREATE POLICY "允许用户更新自己上传的文件"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'public'
  AND (storage.foldername(name))[1] = 'partner-logos'
  AND owner = auth.uid()
)
WITH CHECK (
  bucket_id = 'public'
  AND (storage.foldername(name))[1] = 'partner-logos'
  AND owner = auth.uid()
);

-- 5. 创建策略: 允许管理员删除任何文件
CREATE POLICY "允许管理员删除文件"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'public'
  AND (storage.foldername(name))[1] = 'partner-logos'
  AND (
    owner = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin')
    )
  )
);

-- 6. 显示当前策略
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'objects'
  AND schemaname = 'storage'
ORDER BY policyname;



-- =============================================
-- 文件: 054.5_create_platform_assets_bucket.sql
-- =============================================

-- 创建平台资源存储桶
-- 在 Supabase Storage 中创建用于存储平台资源（如 logo）的存储桶

-- 注意：此脚本需要在 Supabase Dashboard 的 SQL Editor 中执行
-- 或者你可以直接在 Supabase Dashboard > Storage 界面手动创建

-- 注意：存储桶已通过 Dashboard 或 SQL 手动创建，跳过 INSERT 操作
-- INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
-- VALUES (
--   'platform-assets',
--   'platform-assets',
--   true, -- 公开访问
--   2097152, -- 2MB 文件大小限制
--   ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']::text[]
-- )
-- ON CONFLICT (id) DO NOTHING;

-- 创建存储策略：允许所有人读取
-- CREATE POLICY "公开读取平台资源"
-- ON storage.objects FOR SELECT
-- TO public
-- USING (bucket_id = 'platform-assets');

-- 创建存储策略：只有管理员可以上传
-- CREATE POLICY "管理员可以上传平台资源"
-- ON storage.objects FOR INSERT
-- TO authenticated
-- WITH CHECK (
--   bucket_id = 'platform-assets'
--   AND EXISTS (
--     SELECT 1 FROM profiles
--     WHERE profiles.id = auth.uid()
--     AND (profiles.role = 'admin' OR profiles.role = 'super_admin')
--   )
-- );

-- 创建存储策略：只有管理员可以更新
-- CREATE POLICY "管理员可以更新平台资源"
-- ON storage.objects FOR UPDATE
-- TO authenticated
-- USING (
--   bucket_id = 'platform-assets'
--   AND EXISTS (
--     SELECT 1 FROM profiles
--     WHERE profiles.id = auth.uid()
--     AND (profiles.role = 'admin' OR profiles.role = 'super_admin')
--   )
-- );

-- 创建存储策略：只有管理员可以删除
-- CREATE POLICY "管理员可以删除平台资源"
-- ON storage.objects FOR DELETE
-- TO authenticated
-- USING (
--   bucket_id = 'platform-assets'
--   AND EXISTS (
--     SELECT 1 FROM profiles
--     WHERE profiles.id = auth.uid()
--     AND (profiles.role = 'admin' OR profiles.role = 'super_admin')
--   )
-- );

-- COMMENT ON TABLE storage.buckets IS '存储桶: platform-assets 用于存储平台资源文件（如 logo、banner 等）';



-- =============================================
-- 文件: 054.6_fix_storage_policies.sql
-- =============================================

-- 修复 Storage 的 RLS 策略
-- 删除现有的策略并重新创建

-- 1. 删除可能存在的旧策略
DROP POLICY IF EXISTS "公开读取平台资源" ON storage.objects;
DROP POLICY IF EXISTS "管理员可以上传平台资源" ON storage.objects;
DROP POLICY IF EXISTS "管理员可以更新平台资源" ON storage.objects;
DROP POLICY IF EXISTS "管理员可以删除平台资源" ON storage.objects;

-- 2. 创建新的策略

-- 允许所有人读取 platform-assets 中的文件
CREATE POLICY "Anyone can view platform assets"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'platform-assets');

-- 允许认证用户上传到 platform-assets
CREATE POLICY "Authenticated users can upload platform assets"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'platform-assets');

-- 允许认证用户更新 platform-assets 中的文件
CREATE POLICY "Authenticated users can update platform assets"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'platform-assets');

-- 允许认证用户删除 platform-assets 中的文件
CREATE POLICY "Authenticated users can delete platform assets"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'platform-assets');



-- =============================================
-- 文件: 055.5_fix_schema_cache.sql
-- =============================================

-- ============================================================
-- 修复 PostgREST 架构缓存问题
-- ============================================================
-- 说明: 如果 PostgREST 无法找到表或字段,需要重新加载架构缓存
--
-- 使用方法:
-- 1. 打开 Supabase Dashboard
-- 2. 进入 SQL Editor
-- 3. 复制并执行此脚本
-- ============================================================

-- 步骤 1: 通知 PostgREST 重新加载架构
NOTIFY pgrst, 'reload schema';

-- 步骤 2: 等待几秒后,验证 system_settings 表是否存在
SELECT
  table_name,
  table_schema
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name = 'system_settings';

-- 步骤 3: 检查 system_settings 表的所有字段
SELECT
  column_name,
  data_type,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'system_settings'
ORDER BY ordinal_position;

-- 步骤 4: 如果表不存在,创建它(执行基础迁移)
-- 注意: 如果表已存在,这部分会被跳过

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'system_settings'
  ) THEN
    RAISE NOTICE '⚠️  system_settings 表不存在,需要先执行 scripts/045_create_system_settings_table.sql';
  ELSE
    RAISE NOTICE '✅ system_settings 表已存在';
  END IF;
END $$;

-- 步骤 5: 添加缺失的字段
DO $$
BEGIN
  -- 检查并添加 upload_avatar_reward 字段
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'system_settings'
    AND column_name = 'upload_avatar_reward'
  ) THEN
    ALTER TABLE system_settings
    ADD COLUMN upload_avatar_reward INTEGER DEFAULT 30;
    COMMENT ON COLUMN system_settings.upload_avatar_reward IS '首次上传头像奖励积分';
    RAISE NOTICE '✅ 添加字段: upload_avatar_reward';
  ELSE
    RAISE NOTICE '✓ 字段已存在: upload_avatar_reward';
  END IF;

  -- 检查并添加 deposit_merchant_daily_reward 字段
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'system_settings'
    AND column_name = 'deposit_merchant_daily_reward'
  ) THEN
    ALTER TABLE system_settings
    ADD COLUMN deposit_merchant_daily_reward INTEGER DEFAULT 50;
    COMMENT ON COLUMN system_settings.deposit_merchant_daily_reward IS '押金商家每日登录奖励积分';
    RAISE NOTICE '✅ 添加字段: deposit_merchant_daily_reward';
  ELSE
    RAISE NOTICE '✓ 字段已存在: deposit_merchant_daily_reward';
  END IF;

  -- 检查并添加 deposit_merchant_apply_reward 字段
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'system_settings'
    AND column_name = 'deposit_merchant_apply_reward'
  ) THEN
    ALTER TABLE system_settings
    ADD COLUMN deposit_merchant_apply_reward INTEGER DEFAULT 1000;
    COMMENT ON COLUMN system_settings.deposit_merchant_apply_reward IS '押金商家审核通过一次性奖励积分';
    RAISE NOTICE '✅ 添加字段: deposit_merchant_apply_reward';
  ELSE
    RAISE NOTICE '✓ 字段已存在: deposit_merchant_apply_reward';
  END IF;

  -- 检查并添加 merchant_top_cost_per_day 字段
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'system_settings'
    AND column_name = 'merchant_top_cost_per_day'
  ) THEN
    ALTER TABLE system_settings
    ADD COLUMN merchant_top_cost_per_day INTEGER DEFAULT 1000;
    COMMENT ON COLUMN system_settings.merchant_top_cost_per_day IS '商家置顶费用（积分/天）';
    RAISE NOTICE '✅ 添加字段: merchant_top_cost_per_day';
  ELSE
    RAISE NOTICE '✓ 字段已存在: merchant_top_cost_per_day';
  END IF;
END $$;

-- 步骤 6: 更新现有记录,确保新字段有默认值
UPDATE system_settings
SET
  upload_avatar_reward = COALESCE(upload_avatar_reward, 30),
  deposit_merchant_daily_reward = COALESCE(deposit_merchant_daily_reward, 50),
  deposit_merchant_apply_reward = COALESCE(deposit_merchant_apply_reward, 1000),
  merchant_top_cost_per_day = COALESCE(merchant_top_cost_per_day, 1000)
WHERE id = '00000000-0000-0000-0000-000000000001';

-- 步骤 7: 再次通知 PostgREST 重新加载架构
NOTIFY pgrst, 'reload schema';

-- 步骤 8: 验证更新后的表结构
SELECT
  column_name,
  data_type,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'system_settings'
  AND column_name IN (
    'upload_avatar_reward',
    'deposit_merchant_daily_reward',
    'deposit_merchant_apply_reward',
    'merchant_top_cost_per_day'
  )
ORDER BY column_name;

-- 步骤 9: 查看当前系统设置
SELECT
  checkin_points,
  invitation_points,
  register_points,
  merchant_register_points,
  edit_merchant_cost,
  upload_avatar_reward,
  deposit_merchant_daily_reward,
  deposit_merchant_apply_reward,
  merchant_top_cost_per_day
FROM system_settings
WHERE id = '00000000-0000-0000-0000-000000000001';

-- ============================================================
-- 执行完成后的操作:
-- ============================================================
-- 1. 检查上面的输出,确认所有字段都已添加
-- 2. 在浏览器中访问 http://localhost:3000/
-- 3. 如果仍然出现错误,请等待 30 秒让 PostgREST 刷新缓存
-- 4. 如果问题仍然存在,尝试重启 Next.js 开发服务器
-- ============================================================



-- =============================================
-- 文件: 085_production_hotfix.sql
-- =============================================

-- =============================================
-- 生产环境热修复脚本
-- 包含所有被归档但仍然需要的字段和函数
-- =============================================

-- 1. 添加用户封禁相关字段 (来自 039_add_user_ban_fields.sql)
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT FALSE NOT NULL;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS banned_at TIMESTAMPTZ;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS banned_reason TEXT;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS banned_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS report_count INTEGER DEFAULT 0 NOT NULL;

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_profiles_is_banned ON public.profiles(is_banned);

-- 2. 确保签到字段存在 (来自 023_add_checkin_fields_to_profiles.sql)
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS last_checkin TIMESTAMP WITH TIME ZONE;

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS consecutive_checkin_days INTEGER DEFAULT 0;

-- 为现有用户设置默认值
UPDATE profiles
SET consecutive_checkin_days = 0
WHERE consecutive_checkin_days IS NULL;

-- 3. 确保积分记录函数存在 (来自 022_create_point_transactions_table.sql)
CREATE OR REPLACE FUNCTION public.record_point_transaction(
  p_user_id UUID,
  p_amount INTEGER,
  p_type TEXT,
  p_description TEXT,
  p_related_user_id UUID DEFAULT NULL,
  p_related_merchant_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_points INTEGER;
  v_transaction_id UUID;
BEGIN
  -- 获取当前积分
  SELECT points INTO v_current_points
  FROM public.profiles
  WHERE id = p_user_id;

  IF v_current_points IS NULL THEN
    RAISE EXCEPTION 'User profile not found';
  END IF;

  -- 插入交易记录
  INSERT INTO public.point_transactions (
    user_id,
    amount,
    balance_after,
    type,
    description,
    related_user_id,
    related_merchant_id,
    metadata
  ) VALUES (
    p_user_id,
    p_amount,
    v_current_points + p_amount,
    p_type,
    p_description,
    p_related_user_id,
    p_related_merchant_id,
    p_metadata
  )
  RETURNING id INTO v_transaction_id;

  RETURN v_transaction_id;
END;
$$;

-- 4. 创建 now() 包装函数
CREATE OR REPLACE FUNCTION public.now()
RETURNS timestamptz
LANGUAGE sql
STABLE
AS $$
  SELECT now();
$$;

-- 5. 授权
GRANT EXECUTE ON FUNCTION public.record_point_transaction TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.now() TO authenticated, anon, service_role;

-- 6. 验证
SELECT '✅ 生产环境热修复完成' as status;

-- 验证所有必要字段都存在
SELECT
  column_name,
  data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'profiles'
  AND column_name IN (
    'is_banned',
    'banned_at',
    'banned_reason',
    'banned_by',
    'report_count',
    'last_checkin',
    'consecutive_checkin_days'
  )
ORDER BY column_name;



-- =============================================
-- 文件: 084_enable_realtime.sql
-- =============================================

-- =============================================
-- 启用 Supabase Realtime 功能
-- 创建时间: 2025-11-03
-- 说明: 为押金相关表启用实时订阅功能
-- =============================================

-- 1. 为押金申请表启用 Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.deposit_merchant_applications;

-- 2. 为押金退还申请表启用 Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.deposit_refund_applications;

-- 3. 为商家表启用 Realtime（用于监听押金状态变化）
ALTER PUBLICATION supabase_realtime ADD TABLE public.merchants;

-- 验证 Realtime 是否已启用
SELECT schemaname, tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
ORDER BY tablename;

-- =============================================
-- 重要说明：
-- 1. 这个脚本必须在 Supabase SQL Editor 中执行
-- 2. 执行后，实时订阅才能正常工作
-- 3. 如果表已经在 publication 中，会显示错误但不影响功能
-- =============================================


