-- ============================================
-- 文件: 095_migrate_to_system_invitations.sql
-- 描述: 将用户邀请次数迁移到系统配置
-- 作者: System
-- 创建日期: 2025-11-20
-- ============================================

BEGIN;

-- 1. 将所有用户的 max_invitations 设置为 NULL，让他们使用系统配置
-- 注意：如果某些用户需要特殊的邀请次数限制，请先备份数据
UPDATE public.profiles
SET max_invitations = NULL
WHERE max_invitations = 5;  -- 只更新默认值为5的用户

-- 2. 添加注释说明
COMMENT ON COLUMN public.profiles.max_invitations IS '用户的邀请次数上限（NULL=使用系统默认值）';

COMMIT;

-- ============================================
-- 验证迁移成功
-- ============================================

DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO updated_count
  FROM public.profiles
  WHERE max_invitations IS NULL;

  RAISE NOTICE '===========================================';
  RAISE NOTICE '✅ 邀请次数迁移完成';
  RAISE NOTICE '   - % 个用户将使用系统配置的邀请次数', updated_count;
  RAISE NOTICE '   - 系统配置路径: 管理后台 > 系统设置 > 邀请系统配置';
  RAISE NOTICE '===========================================';
END $$;
