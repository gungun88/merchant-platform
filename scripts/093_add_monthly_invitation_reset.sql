-- ============================================
-- 文件: 093_add_monthly_invitation_reset.sql
-- 描述: 添加邀请次数按月重置功能
-- 作者: System
-- 创建日期: 2025-11-20
-- ============================================

BEGIN;

-- 1. 在 profiles 表添加记录上次重置月份的字段
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS invitation_reset_month TEXT DEFAULT TO_CHAR(NOW(), 'YYYY-MM');

-- 2. 在 system_settings 表添加按月重置开关
ALTER TABLE public.system_settings
ADD COLUMN IF NOT EXISTS invitation_monthly_reset BOOLEAN DEFAULT true;

-- 3. 更新已有用户的 invitation_reset_month 为当前月份
UPDATE public.profiles
SET invitation_reset_month = TO_CHAR(NOW(), 'YYYY-MM')
WHERE invitation_reset_month IS NULL;

-- 4. 添加注释
COMMENT ON COLUMN public.profiles.invitation_reset_month IS '邀请次数上次重置的月份 (格式: YYYY-MM)';
COMMENT ON COLUMN public.system_settings.invitation_monthly_reset IS '是否启用邀请次数按月重置';

COMMIT;

-- ============================================
-- 验证迁移成功
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '===========================================';
  RAISE NOTICE '✅ 邀请次数按月重置功能已添加';
  RAISE NOTICE '   - profiles.invitation_reset_month 字段已创建';
  RAISE NOTICE '   - system_settings.invitation_monthly_reset 字段已创建';
  RAISE NOTICE '   - 默认启用按月重置功能';
  RAISE NOTICE '===========================================';
END $$;
