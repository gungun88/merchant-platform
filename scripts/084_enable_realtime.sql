-- =============================================
-- 启用 Supabase Realtime 功能
-- 创建时间: 2025-11-03
-- 说明: 为押金相关表启用实时订阅功能
-- =============================================

-- 1. 为押金申请表启用 Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.deposit_merchant_applications;

-- 2. 为押金退还申请表启用 Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.deposit_refund_applications;

-- 3. 为商家表启用 Realtime（用于监听押金状态变化）
ALTER PUBLICATION supabase_realtime ADD TABLE public.merchants;

-- 验证 Realtime 是否已启用
SELECT schemaname, tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
ORDER BY tablename;

-- =============================================
-- 重要说明：
-- 1. 这个脚本必须在 Supabase SQL Editor 中执行
-- 2. 执行后，实时订阅才能正常工作
-- 3. 如果表已经在 publication 中，会显示错误但不影响功能
-- =============================================
