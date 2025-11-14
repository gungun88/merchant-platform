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
