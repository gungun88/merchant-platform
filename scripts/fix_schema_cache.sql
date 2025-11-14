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
