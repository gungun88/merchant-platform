const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// 手动读取 .env.local
const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    envVars[match[1].trim()] = match[2].trim();
  }
});

const supabase = createClient(
  envVars.NEXT_PUBLIC_SUPABASE_URL,
  envVars.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  try {
    // 查找用户 ID 以 7c3af6cd 开头的用户
    const { data: { users } } = await supabase.auth.admin.listUsers();
    const targetUser = users.find(u => u.id.startsWith('7c3af6cd'));

    if (!targetUser) {
      console.log('未找到用户 7c3af6cd');
      return;
    }

    const userId = targetUser.id;
    console.log('检查用户ID:', userId);
    console.log('='.repeat(60));

    // 获取 profile 中的积分
    const { data: profile } = await supabase
      .from('profiles')
      .select('points')
      .eq('id', userId)
      .single();

    console.log('\n【Profile 表中的数据】');
    console.log('当前积分:', profile?.points);

    // 获取最新的交易记录
    const { data: transactions } = await supabase
      .from('point_transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(15);

    console.log('\n【最新的15条交易记录】');
    transactions?.forEach((t, idx) => {
      const sign = t.amount > 0 ? '+' : '';
      console.log(`${(idx + 1).toString().padStart(2)}. ${t.created_at} | ${t.type.padEnd(25)} | ${sign}${t.amount.toString().padStart(5)}积分 | 余额: ${t.balance_after.toString().padStart(5)} | ${t.description}`);
    });

    // 计算所有交易的累计
    const { data: allTrans } = await supabase
      .from('point_transactions')
      .select('amount')
      .eq('user_id', userId);

    const calculated = allTrans?.reduce((sum, t) => sum + t.amount, 0) || 0;

    console.log('\n【积分计算对比】');
    console.log('Profile 中的积分:          ', profile?.points);
    console.log('所有交易累计的积分:         ', calculated);
    console.log('最新交易记录的 balance_after:', transactions?.[0]?.balance_after);
    console.log('差异:', profile?.points - calculated);

    // 手动验证最新几条交易
    console.log('\n【手动验证计算】');
    console.log('根据截图:');
    console.log('  最新交易: 查看联系方式 -50, 余额应该是 1217');
    console.log('  上一条:   每日签到 +5,    余额应该是 1267');
    console.log('  再上一条: 商家置顶 -2000, 余额应该是 1262');

    if (profile?.points !== calculated) {
      console.log('\n⚠️  发现不一致!');
      console.log('需要修复的差异:', calculated - profile?.points);
    } else {
      console.log('\n✅ 积分数据一致');
    }

  } catch (error) {
    console.error('错误:', error);
  }
})();
