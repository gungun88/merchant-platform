-- 检查问题用户的详细信息
-- 查看 i2md9 和 x3yo8 用户的完整数据

-- 1. 查看这两个用户的 profiles 数据
SELECT
  username,
  points,
  user_number,
  created_at,
  role
FROM profiles
WHERE username IN ('i2md9', 'x3yo8')
ORDER BY created_at DESC;

-- 2. 查看这两个用户的交易记录
SELECT
  p.username,
  pt.amount,
  pt.type,
  pt.description,
  pt.balance_after,
  pt.created_at
FROM point_transactions pt
JOIN profiles p ON p.id = pt.user_id
WHERE p.username IN ('i2md9', 'x3yo8')
ORDER BY p.username, pt.created_at;

-- 3. 查看所有没有用户编号的用户
SELECT
  username,
  points,
  user_number,
  created_at
FROM profiles
WHERE user_number IS NULL
ORDER BY created_at DESC;

-- 4. 查看所有积分为0且没有交易记录的用户
SELECT
  p.username,
  p.points,
  p.user_number,
  p.created_at,
  (SELECT COUNT(*) FROM point_transactions pt WHERE pt.user_id = p.id) as transaction_count
FROM profiles p
WHERE p.points = 0
ORDER BY p.created_at DESC;
