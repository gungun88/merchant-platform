-- ============================================
-- 文件: 089_fix_checkin_missing_functions.sql
-- 描述: 修复生产环境签到功能缺失的必要函数
-- 作者: System
-- 创建日期: 2025-11-19
-- ============================================

-- 说明:
-- 生产环境签到功能报错,原因是缺少以下RPC函数:
-- 1. now() - 获取数据库服务器时间
-- 2. record_point_transaction() - 记录积分交易

BEGIN;

-- ============================================
-- 第一步: 创建 record_point_transaction 函数
-- ============================================

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
  v_new_points INTEGER;
  v_transaction_id UUID;
BEGIN
  -- 获取当前积分
  SELECT points INTO v_current_points
  FROM profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF v_current_points IS NULL THEN
    RAISE EXCEPTION '用户不存在: %', p_user_id;
  END IF;

  -- 计算新积分
  v_new_points := v_current_points + p_amount;

  -- 更新用户积分
  UPDATE profiles
  SET points = v_new_points,
      updated_at = NOW()
  WHERE id = p_user_id;

  -- 记录交易
  INSERT INTO point_transactions (
    user_id,
    amount,
    balance_after,
    type,
    description,
    related_user_id,
    related_merchant_id,
    metadata
  )
  VALUES (
    p_user_id,
    p_amount,
    v_new_points,
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

-- ============================================
-- 第二步: 创建 now() 包装函数
-- ============================================

CREATE OR REPLACE FUNCTION public.now()
RETURNS timestamptz
LANGUAGE sql
STABLE
AS $$
  SELECT now();
$$;

-- ============================================
-- 第三步: 授予权限
-- ============================================

GRANT EXECUTE ON FUNCTION public.record_point_transaction TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.now() TO authenticated, anon, service_role;

-- ============================================
-- 第四步: 验证函数创建成功
-- ============================================

DO $$
DECLARE
  v_now_exists BOOLEAN;
  v_record_exists BOOLEAN;
BEGIN
  -- 检查 now() 函数
  SELECT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.proname = 'now'
  ) INTO v_now_exists;

  -- 检查 record_point_transaction 函数
  SELECT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.proname = 'record_point_transaction'
  ) INTO v_record_exists;

  RAISE NOTICE '===========================================';
  RAISE NOTICE '函数验证结果:';

  IF v_now_exists THEN
    RAISE NOTICE '✅ now() 函数已创建';
  ELSE
    RAISE WARNING '❌ now() 函数创建失败';
  END IF;

  IF v_record_exists THEN
    RAISE NOTICE '✅ record_point_transaction() 函数已创建';
  ELSE
    RAISE WARNING '❌ record_point_transaction() 函数创建失败';
  END IF;

  RAISE NOTICE '===========================================';

  IF v_now_exists AND v_record_exists THEN
    RAISE NOTICE '✅ 所有必需函数已成功创建，签到功能应该可以正常使用了！';
  ELSE
    RAISE WARNING '⚠️  部分函数创建失败，请检查错误日志';
  END IF;
END $$;

COMMIT;

-- ============================================
-- 脚本执行完成
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '===========================================';
  RAISE NOTICE '✅ 脚本执行完成!';
  RAISE NOTICE '===========================================';
  RAISE NOTICE '';
  RAISE NOTICE '下一步操作:';
  RAISE NOTICE '1. 刷新生产环境页面';
  RAISE NOTICE '2. 尝试点击"每日签到"按钮';
  RAISE NOTICE '3. 确认签到功能正常工作';
  RAISE NOTICE '';
END $$;
