-- 查找所有与通知相关的表

SELECT
  table_name,
  table_schema
FROM information_schema.tables
WHERE table_schema = 'public'
  AND (
    table_name LIKE '%notification%'
    OR table_name LIKE '%notify%'
    OR table_name LIKE '%message%'
    OR table_name LIKE '%alert%'
  )
ORDER BY table_name;
