-- =============================================
-- 清理押金退还申请相关对象（如果需要重新创建）
-- =============================================

-- 1. 删除索引（如果存在）
DROP INDEX IF EXISTS public.idx_deposit_refund_merchant;
DROP INDEX IF EXISTS public.idx_deposit_refund_user;
DROP INDEX IF EXISTS public.idx_deposit_refund_status;
DROP INDEX IF EXISTS public.idx_deposit_refund_created;

-- 2. 删除触发器（如果存在）
DROP TRIGGER IF EXISTS trigger_update_deposit_refund_applications_updated_at ON public.deposit_refund_applications;

-- 3. 删除函数（如果存在）
DROP FUNCTION IF EXISTS update_deposit_refund_applications_updated_at();

-- 4. 删除表（如果存在）- 注意：这会删除所有数据！
DROP TABLE IF EXISTS public.deposit_refund_applications CASCADE;

-- 5. 清理 merchants 表添加的字段（可选）
-- 如果你想保留这些字段，可以注释掉下面的语句
ALTER TABLE public.merchants DROP COLUMN IF EXISTS deposit_refund_requested_at;
ALTER TABLE public.merchants DROP COLUMN IF EXISTS deposit_refund_completed_at;
ALTER TABLE public.merchants DROP COLUMN IF EXISTS deposit_refund_status;

-- 完成
SELECT 'cleanup completed' as status;
