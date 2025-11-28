const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env.local');
  const envContent = fs.readFileSync(envPath, 'utf8');
  const env = {};
  envContent.split('\n').forEach(line => {
    const [key, ...values] = line.split('=');
    if (key && values.length > 0) {
      env[key.trim()] = values.join('=').trim();
    }
  });
  return env;
}

async function checkPointsCalculation() {
  const env = loadEnv();
  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  const email = 'kzvpr5iwf9@zudpck.com';

  console.log(`\n=== 检查用户积分计算 ===`);
  console.log(`邮箱: ${email}\n`);

  // 1. 获取用户信息
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('email', email)
    .single();

  if (profileError || !profile) {
    console.error('❌ 用户不存在');
    return;
  }

  console.log('用户信息:');
  console.log('  - User Number:', profile.user_number);
  console.log('  - Username:', profile.username);
  console.log('  - Profile 中的积分:', profile.points);

  // 2. 获取积分交易记录
  const { data: transactions, error: transError } = await supabase
    .from('point_transactions')
    .select('*')
    .eq('user_id', profile.id)
    .order('created_at', { ascending: true });

  if (transError) {
    console.error('❌ 获取交易记录失败:', transError);
    return;
  }

  console.log(`\n积分交易记录 (共 ${transactions.length} 条):`);

  let calculatedBalance = 0;
  transactions.forEach((t, index) => {
    calculatedBalance += t.amount;
    console.log(`\n${index + 1}. [${t.type}] ${t.description}`);
    console.log(`   金额: ${t.amount > 0 ? '+' : ''}${t.amount}`);
    console.log(`   时间: ${t.created_at}`);
    console.log(`   计算余额: ${calculatedBalance}`);
  });

  console.log('\n=== 对比结果 ===');
  console.log(`profiles.points (数据库): ${profile.points}`);
  console.log(`计算出的余额 (交易记录累加): ${calculatedBalance}`);

  if (profile.points !== calculatedBalance) {
    console.log(`\n⚠️  不一致！差异: ${profile.points - calculatedBalance}`);
    console.log(`\n可能原因:`);
    console.log(`1. 有些积分变动没有记录到 point_transactions`);
    console.log(`2. profiles.points 被直接修改而没有通过 RPC 函数`);
    console.log(`3. 注册流程中多次增加了积分`);
  } else {
    console.log(`\n✅ 一致！积分计算正确`);
  }
}

checkPointsCalculation().catch(console.error);
