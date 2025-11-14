-- ====================================================================
-- 为已通过审核但没有到期时间的合作伙伴设置到期时间
-- 用途: 补充旧数据的到期时间字段
-- 执行时机: 在 039 脚本之后执行
-- ====================================================================

-- 为所有已通过但没有到期时间的合作伙伴设置到期时间
-- 计算方式: 审核通过时间 + duration_years 年
UPDATE partners
SET expires_at = (approved_at::timestamp + (COALESCE(duration_years, 1) || ' years')::interval)
WHERE status = 'approved'
  AND expires_at IS NULL
  AND approved_at IS NOT NULL;

-- 验证更新结果
SELECT
  id,
  name,
  status,
  duration_years,
  approved_at,
  expires_at,
  CASE
    WHEN expires_at IS NOT NULL THEN '已设置'
    ELSE '未设置'
  END as expiry_status
FROM partners
WHERE status = 'approved'
ORDER BY approved_at DESC;
