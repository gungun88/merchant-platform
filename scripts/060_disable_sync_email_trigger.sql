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
