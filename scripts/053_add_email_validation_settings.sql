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
