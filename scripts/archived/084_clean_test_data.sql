-- ⚠️ 警告：此脚本会删除所有测试数据，仅在上线前执行一次！
-- 请先备份重要数据，确认无误后再执行

-- 开始事务
BEGIN;

-- 1. 清空财务数据
TRUNCATE TABLE platform_income CASCADE;

-- 2. 清空合作伙伴相关
TRUNCATE TABLE partner_subscriptions CASCADE;
TRUNCATE TABLE partners CASCADE;

-- 3. 清空押金相关
TRUNCATE TABLE deposit_refund_applications CASCADE;
TRUNCATE TABLE deposit_merchant_applications CASCADE;
TRUNCATE TABLE daily_login_rewards CASCADE;

-- 4. 清空商家数据
TRUNCATE TABLE merchants CASCADE;

-- 5. 清空积分相关
TRUNCATE TABLE scheduled_point_transfers CASCADE;
TRUNCATE TABLE point_transactions CASCADE;

-- 6. 清空邀请相关
TRUNCATE TABLE user_invitations CASCADE;

-- 7. 清空通知
TRUNCATE TABLE notifications CASCADE;

-- 8. 清空举报
TRUNCATE TABLE reports CASCADE;

-- 9. 清空公告
TRUNCATE TABLE announcements CASCADE;

-- 10. 清空联系消息
TRUNCATE TABLE contact_messages CASCADE;

-- 11. 清空管理员操作日志（可选，建议保留用于审计）
-- TRUNCATE TABLE admin_operation_logs CASCADE;

-- 12. 删除普通用户（保留管理员账号）
-- ⚠️ 请根据实际情况修改管理员邮箱
DO $$
DECLARE
    admin_emails TEXT[] := ARRAY['your-admin@email.com']; -- 替换为你的管理员邮箱
    user_record RECORD;
BEGIN
    FOR user_record IN
        SELECT id FROM auth.users
        WHERE email NOT IN (SELECT unnest(admin_emails))
    LOOP
        -- 删除 profiles 表中的记录
        DELETE FROM profiles WHERE id = user_record.id;

        -- 删除 auth.users 表中的记录
        DELETE FROM auth.users WHERE id = user_record.id;
    END LOOP;
END $$;

-- 13. 重置系统设置为默认值（可选）
UPDATE system_settings SET
    deposit_amount = 340.00,
    deposit_fee_rate_before_3_months = 30,
    deposit_fee_rate_after_3_months = 15,
    deposit_merchant_daily_reward = 50,
    deposit_merchant_apply_reward = 1000,
    invitation_reward = 100,
    user_register_reward = 100,
    partner_subscription_fee_monthly = 50,
    partner_subscription_fee_yearly = 500,
    merchants_per_page = 12,
    low_points_threshold = 100;

-- 提交事务
COMMIT;

-- 验证清理结果
SELECT 'merchants' as table_name, COUNT(*) as count FROM merchants
UNION ALL
SELECT 'partners', COUNT(*) FROM partners
UNION ALL
SELECT 'platform_income', COUNT(*) FROM platform_income
UNION ALL
SELECT 'point_transactions', COUNT(*) FROM point_transactions
UNION ALL
SELECT 'notifications', COUNT(*) FROM notifications
UNION ALL
SELECT 'profiles', COUNT(*) FROM profiles
UNION ALL
SELECT 'auth.users', COUNT(*) FROM auth.users;

-- 如果需要回滚，执行：
-- ROLLBACK;
