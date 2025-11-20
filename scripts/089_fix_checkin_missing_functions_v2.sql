-- ============================================
-- 文件: 089_fix_checkin_missing_functions.sql
-- 描述: 修复生产环境签到功能 - 只创建 now() 函数
-- 作者: System
-- 创建日期: 2025-11-19
-- 版本: v2 - 简化版
-- ============================================

-- 说明:
-- 生产环境签到功能报错,只需要创建 now() 函数即可
-- record_point_transaction() 函数应该已经存在(在022脚本中创建)

BEGIN;

-- ============================================
-- 创建 now() 包装函数
-- ============================================

CREATE OR REPLACE FUNCTION public.now()
RETURNS timestamptz
LANGUAGE sql
STABLE
AS $$
  SELECT now();
$$;

-- 授予权限
GRANT EXECUTE ON FUNCTION public.now() TO authenticated, anon, service_role;

-- ============================================
-- 验证函数创建成功
-- ============================================

DO $$
DECLARE
  v_now_exists BOOLEAN;
BEGIN
  -- 检查 now() 函数
  SELECT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.proname = 'now'
  ) INTO v_now_exists;

  RAISE NOTICE '===========================================';

  IF v_now_exists THEN
    RAISE NOTICE '✅ now() 函数已创建成功';
    RAISE NOTICE '✅ 签到功能应该可以正常使用了';
  ELSE
    RAISE WARNING '❌ now() 函数创建失败';
  END IF;

  RAISE NOTICE '===========================================';
END $$;

COMMIT;

-- ============================================
-- 脚本执行完成
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '下一步操作:';
  RAISE NOTICE '1. 刷新生产环境页面';
  RAISE NOTICE '2. 尝试点击"每日签到"按钮';
  RAISE NOTICE '3. 确认签到功能正常工作';
  RAISE NOTICE '';
END $$;
