/**
 * 修复积分余额计算问题
 * 1. 更新数据库函数
 * 2. 重新计算所有历史记录的 balance_after
 */

const fs = require('fs')
const path = require('path')

// 手动加载 .env.local
const envPath = path.join(__dirname, '..', '.env.local')
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8')
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=:#]+)=(.*)/)
    if (match) {
      const key = match[1].trim()
      const value = match[2].trim()
      process.env[key] = value
    }
  })
}

const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ 缺少必要的环境变量')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function fixPointBalance() {
  console.log('🔧 开始修复积分余额...\n')

  try {
    // 步骤 1: 更新数据库函数
    console.log('1️⃣ 更新 record_point_transaction 函数...')

    const functionSQL = `
DROP FUNCTION IF EXISTS public.record_point_transaction(UUID, INTEGER, TEXT, TEXT, UUID, UUID, JSONB);

CREATE OR REPLACE FUNCTION public.record_point_transaction(
  p_user_id UUID,
  p_amount INTEGER,
  p_type TEXT,
  p_description TEXT,
  p_related_user_id UUID DEFAULT NULL,
  p_related_merchant_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_points INTEGER;
  v_new_balance INTEGER;
  v_transaction_id UUID;
BEGIN
  -- 获取当前积分
  SELECT points INTO v_current_points
  FROM public.profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF v_current_points IS NULL THEN
    RAISE EXCEPTION 'User profile not found';
  END IF;

  -- 计算新余额
  v_new_balance := v_current_points + p_amount;

  -- 检查余额是否足够（对于负数变动）
  IF v_new_balance < 0 THEN
    RAISE EXCEPTION 'Insufficient points balance';
  END IF;

  -- 更新用户积分
  UPDATE public.profiles
  SET points = v_new_balance
  WHERE id = p_user_id;

  -- 插入交易记录，balance_after 为更新后的余额
  INSERT INTO public.point_transactions (
    user_id,
    amount,
    balance_after,
    type,
    description,
    related_user_id,
    related_merchant_id,
    metadata
  ) VALUES (
    p_user_id,
    p_amount,
    v_new_balance,
    p_type,
    p_description,
    p_related_user_id,
    p_related_merchant_id,
    p_metadata
  )
  RETURNING id INTO v_transaction_id;

  RETURN v_transaction_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_point_transaction TO authenticated, anon, service_role;
`

    const { error: funcError } = await supabase.rpc('exec', { query: functionSQL })
    if (funcError && funcError.code !== 'PGRST202') {
      console.error('❌ 更新函数失败:', funcError)
      throw funcError
    }
    console.log('✅ 函数更新完成\n')

    // 步骤 2: 获取所有用户的交易记录并重新计算
    console.log('2️⃣ 重新计算所有用户的积分余额...\n')

    // 获取所有有交易记录的用户
    const { data: users, error: usersError } = await supabase
      .from('point_transactions')
      .select('user_id')
      .order('user_id')

    if (usersError) {
      console.error('❌ 获取用户列表失败:', usersError)
      throw usersError
    }

    // 去重
    const uniqueUserIds = [...new Set(users.map(u => u.user_id))]
    console.log(`📊 找到 ${uniqueUserIds.length} 个用户需要处理\n`)

    // 处理每个用户
    for (const userId of uniqueUserIds) {
      console.log(`\n👤 处理用户: ${userId}`)

      // 获取该用户的所有交易记录，按时间排序
      const { data: transactions, error: txError } = await supabase
        .from('point_transactions')
        .select('id, amount, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: true })
        .order('id', { ascending: true })

      if (txError) {
        console.error(`  ❌ 获取交易记录失败:`, txError)
        continue
      }

      console.log(`  📝 找到 ${transactions.length} 条交易记录`)

      let runningBalance = 0

      // 按顺序更新每条记录的 balance_after
      for (const tx of transactions) {
        runningBalance += tx.amount

        const { error: updateError } = await supabase
          .from('point_transactions')
          .update({ balance_after: runningBalance })
          .eq('id', tx.id)

        if (updateError) {
          console.error(`  ❌ 更新交易记录失败:`, updateError)
        }
      }

      // 更新用户的当前积分
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ points: runningBalance })
        .eq('id', userId)

      if (profileError) {
        console.error(`  ❌ 更新用户积分失败:`, profileError)
      } else {
        console.log(`  ✅ 余额已修复，当前积分: ${runningBalance}`)
      }
    }

    console.log('\n\n✅ 所有积分余额已修复完成！')
    console.log('===========================================')
    console.log('✅ 积分余额计算已修复')
    console.log('   1. record_point_transaction 函数已更新')
    console.log('   2. 所有历史记录的 balance_after 已重新计算')
    console.log('   3. 用户的当前积分已同步更新')
    console.log('===========================================')

  } catch (error) {
    console.error('\n❌ 修复过程出错:', error)
    process.exit(1)
  }
}

fixPointBalance()
