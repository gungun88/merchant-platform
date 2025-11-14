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
