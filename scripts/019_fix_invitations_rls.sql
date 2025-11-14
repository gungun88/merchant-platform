-- 修复 invitations 表的 RLS 策略

-- 1. 删除现有的 RLS 策略
DROP POLICY IF EXISTS "invitations_select_own" ON public.invitations;
DROP POLICY IF EXISTS "invitations_insert_authenticated" ON public.invitations;

-- 2. 创建新的 RLS 策略
-- 用户可以查看与自己相关的邀请记录（作为邀请人或被邀请人）
CREATE POLICY "invitations_select_own"
  ON public.invitations FOR SELECT
  USING (auth.uid() = inviter_id OR auth.uid() = invitee_id);

-- 允许已认证用户创建邀请记录（用于邀请奖励系统）
CREATE POLICY "invitations_insert_authenticated"
  ON public.invitations FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
