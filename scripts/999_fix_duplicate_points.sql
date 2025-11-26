-- ====================================================================
-- 修复新用户注册积分重复计算问题
-- 问题: 新用户注册获得 200 积分,但应该只有 100 积分
-- 原因: 触发器设置了初始积分,然后 record_point_transaction 又加了一次
-- 解决: 触发器中不设置初始积分,让 record_point_transaction 自动处理
-- ====================================================================

-- ============================================================
-- 第一步: 修复触发器 - 不要设置初始积分
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invitation_code TEXT;
  v_register_points INTEGER;
  v_profile_exists BOOLEAN;
  v_user_number INTEGER;
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '🔔 新用户注册触发器开始执行';
  RAISE NOTICE '用户ID: %', new.id;
  RAISE NOTICE '用户邮箱: %', new.email;
  RAISE NOTICE '========================================';

  -- 检查 profile 是否已存在
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = new.id
  ) INTO v_profile_exists;

  IF v_profile_exists THEN
    RAISE NOTICE '⚠️  Profile 已存在,跳过创建';
    RETURN new;
  END IF;

  -- 获取下一个用户编号
  v_user_number := nextval('user_number_seq');
  RAISE NOTICE '✅ 分配用户编号: %', v_user_number;

  -- 从系统设置获取注册奖励积分
  SELECT register_points INTO v_register_points
  FROM system_settings
  WHERE id = '00000000-0000-0000-0000-000000000001'
  LIMIT 1;

  -- 如果没有设置,使用默认值
  IF v_register_points IS NULL THEN
    v_register_points := 100;
    RAISE NOTICE '⚠️  使用默认注册积分: %', v_register_points;
  ELSE
    RAISE NOTICE '✅ 使用系统设置注册积分: %', v_register_points;
  END IF;

  -- 生成邀请码
  BEGIN
    v_invitation_code := generate_invitation_code();
    RAISE NOTICE '✅ 生成邀请码: %', v_invitation_code;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '⚠️  邀请码生成失败: %, 使用备用方案', SQLERRM;
    v_invitation_code := substring(md5(random()::text || new.id::text) from 1 for 8);
    RAISE NOTICE '✅ 使用备用邀请码: %', v_invitation_code;
  END;

  -- 插入用户 profile (不设置 points,让 record_point_transaction 处理)
  BEGIN
    INSERT INTO public.profiles (
      id,
      username,
      email,
      user_number,
      points,          -- ⚠️ 设置为 0,由 record_point_transaction 更新
      is_merchant,
      invitation_code,
      role,
      max_invitations,
      used_invitations,
      created_at,
      updated_at
    )
    VALUES (
      new.id,
      COALESCE(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1)),
      new.email,
      v_user_number,
      0,                    -- ⚠️ 初始积分为 0
      false,
      v_invitation_code,
      'user',
      5,
      0,
      NOW(),
      NOW()
    )
    ON CONFLICT (id) DO NOTHING;

    RAISE NOTICE '✅ Profile 创建成功 (初始积分: 0)';
    RAISE NOTICE '   - 用户名: %', COALESCE(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1));
    RAISE NOTICE '   - 用户编号: %', v_user_number;
    RAISE NOTICE '   - 邀请码: %', v_invitation_code;

  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '❌ Profile 创建失败: %', SQLERRM;
    -- 不中止事务
  END;

  -- 记录注册积分交易 (这会自动更新用户积分)
  BEGIN
    PERFORM record_point_transaction(
      new.id,
      v_register_points,      -- 注册奖励积分
      'registration',
      '注册赠送积分 +' || v_register_points || '积分',
      NULL,
      NULL,
      jsonb_build_object('source', 'registration', 'user_number', v_user_number)
    );
    RAISE NOTICE '✅ 积分交易记录成功 (用户积分自动更新为: %)', v_register_points;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '⚠️  积分交易记录失败: %', SQLERRM;
  END;

  -- 发送注册欢迎通知
  BEGIN
    PERFORM create_notification(
      new.id,
      'system',
      'registration',
      '欢迎加入',
      '注册成功！您已获得 ' || v_register_points || ' 积分奖励，您的用户编号是 NO.' || v_user_number || '，快去体验吧！',
      NULL,
      NULL,
      jsonb_build_object('points', v_register_points, 'user_number', v_user_number),
      'normal',
      NULL
    );
    RAISE NOTICE '✅ 欢迎通知发送成功';
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '⚠️  欢迎通知发送失败: %', SQLERRM;
  END;

  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ 新用户注册触发器执行完成';
  RAISE NOTICE '   最终积分: %', v_register_points;
  RAISE NOTICE '========================================';

  RETURN new;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '❌ 注册触发器执行失败: %', SQLERRM;
  RETURN new;
END;
$$;

-- 重新创建触发器
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

COMMENT ON FUNCTION public.handle_new_user IS '处理新用户注册：创建profile（初始积分0）、通过record_point_transaction发放积分、发送欢迎通知';

-- ============================================================
-- 第二步: 修复已经注册但积分重复的用户
-- ============================================================

-- 2.1 找出积分异常的用户 (注册时间在最近,但积分是 200 或其他异常值)
SELECT
  '=== 积分异常的新用户 ===' AS info,
  id,
  username,
  user_number,
  points,
  created_at
FROM profiles
WHERE created_at > NOW() - INTERVAL '7 days'  -- 最近7天注册
  AND points > 150  -- 积分大于150 (疑似重复)
ORDER BY created_at DESC
LIMIT 20;

-- 2.2 自动修复积分异常的用户
DO $$
DECLARE
  profile_record RECORD;
  v_correct_points INTEGER := 100;  -- 正确的注册积分
  fixed_count INTEGER := 0;
  v_excess_points INTEGER;
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '🔧 开始修复积分重复的用户';
  RAISE NOTICE '========================================';

  -- 获取系统设置的注册积分
  SELECT register_points INTO v_correct_points
  FROM system_settings
  WHERE id = '00000000-0000-0000-0000-000000000001'
  LIMIT 1;

  IF v_correct_points IS NULL THEN
    v_correct_points := 100;
  END IF;

  RAISE NOTICE '正确的注册积分应该是: %', v_correct_points;

  -- 找出并修复积分异常的用户
  FOR profile_record IN
    SELECT id, username, points, created_at
    FROM profiles
    WHERE created_at > NOW() - INTERVAL '7 days'
      AND points > v_correct_points * 1.5  -- 积分明显过高
      AND points < 1000  -- 排除积极使用的老用户
    ORDER BY created_at DESC
  LOOP
    BEGIN
      v_excess_points := profile_record.points - v_correct_points;

      -- 更新用户积分为正确值
      UPDATE profiles
      SET points = v_correct_points
      WHERE id = profile_record.id;

      RAISE NOTICE '✅ 修复用户 % - 从 % 积分调整为 %',
        profile_record.username,
        profile_record.points,
        v_correct_points;

      -- 记录调整
      BEGIN
        INSERT INTO point_transactions (
          user_id,
          amount,
          balance_after,
          type,
          description,
          metadata
        ) VALUES (
          profile_record.id,
          -v_excess_points,
          v_correct_points,
          'system_fix',
          '系统修复：撤销重复发放的积分 -' || v_excess_points || '积分',
          jsonb_build_object(
            'source', 'registration_fix',
            'original_points', profile_record.points,
            'corrected_points', v_correct_points,
            'excess_points', v_excess_points
          )
        );
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING '⚠️  记录调整失败: %', SQLERRM;
      END;

      fixed_count := fixed_count + 1;

    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '❌ 修复用户 % 失败: %', profile_record.id, SQLERRM;
    END;
  END LOOP;

  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ 修复完成! 共修复 % 个用户', fixed_count;
  RAISE NOTICE '========================================';
END $$;

-- ============================================================
-- 第三步: 验证修复结果
-- ============================================================

-- 3.1 检查最近注册用户的积分
SELECT
  '=== 最近注册用户积分检查 ===' AS info,
  username,
  user_number,
  points,
  created_at
FROM profiles
WHERE created_at > NOW() - INTERVAL '7 days'
ORDER BY created_at DESC
LIMIT 10;

-- 3.2 统计积分分布
SELECT
  '=== 新用户积分分布 ===' AS info,
  points,
  COUNT(*) AS user_count
FROM profiles
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY points
ORDER BY points;

-- 完成提示
SELECT
  '✅ 积分重复问题修复完成' AS status,
  '触发器已更新，现有用户积分已修正' AS description,
  NOW() AS executed_at;
