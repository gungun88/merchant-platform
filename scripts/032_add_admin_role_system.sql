-- 添加管理员角色系统
-- 在 profiles 表中添加 role 字段

-- 1. 添加 role 字段到 profiles 表
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user';

-- 2. 添加 role 字段的检查约束
ALTER TABLE public.profiles
ADD CONSTRAINT profiles_role_check
CHECK (role IN ('user', 'admin', 'super_admin'));

-- 3. 为 role 字段创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

-- 4. 创建管理员操作日志表
CREATE TABLE IF NOT EXISTS public.admin_operation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  operation_type TEXT NOT NULL, -- 操作类型: approve_merchant, reject_deposit, ban_user 等
  target_type TEXT NOT NULL, -- 目标类型: merchant, user, deposit_application 等
  target_id UUID, -- 目标ID
  description TEXT NOT NULL, -- 操作描述
  metadata JSONB, -- 额外的元数据
  ip_address TEXT, -- 操作IP地址
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 5. 为管理员操作日志创建索引
CREATE INDEX IF NOT EXISTS idx_admin_logs_admin_id ON public.admin_operation_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_logs_created_at ON public.admin_operation_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_logs_operation_type ON public.admin_operation_logs(operation_type);

-- 6. 启用 RLS
ALTER TABLE public.admin_operation_logs ENABLE ROW LEVEL SECURITY;

-- 7. 创建 RLS 策略 - 只有管理员可以查看日志
CREATE POLICY "管理员可以查看所有操作日志"
  ON public.admin_operation_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- 8. 创建 RLS 策略 - 只有管理员可以创建日志
CREATE POLICY "管理员可以创建操作日志"
  ON public.admin_operation_logs
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- 9. 创建辅助函数 - 检查用户是否是管理员
CREATE OR REPLACE FUNCTION public.is_admin(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = user_id
    AND role IN ('admin', 'super_admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. 创建辅助函数 - 记录管理员操作
CREATE OR REPLACE FUNCTION public.log_admin_operation(
  p_operation_type TEXT,
  p_target_type TEXT,
  p_target_id UUID,
  p_description TEXT,
  p_metadata JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_log_id UUID;
BEGIN
  -- 检查当前用户是否是管理员
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION '只有管理员可以记录操作日志';
  END IF;

  -- 插入日志记录
  INSERT INTO public.admin_operation_logs (
    admin_id,
    operation_type,
    target_type,
    target_id,
    description,
    metadata
  ) VALUES (
    auth.uid(),
    p_operation_type,
    p_target_type,
    p_target_id,
    p_description,
    p_metadata
  ) RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 11. 添加注释
COMMENT ON COLUMN public.profiles.role IS '用户角色: user(普通用户), admin(管理员), super_admin(超级管理员)';
COMMENT ON TABLE public.admin_operation_logs IS '管理员操作日志表';
COMMENT ON FUNCTION public.is_admin IS '检查用户是否是管理员';
COMMENT ON FUNCTION public.log_admin_operation IS '记录管理员操作日志';

-- 完成
SELECT 'Admin role system created successfully' AS status;
