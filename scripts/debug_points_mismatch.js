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
    // 获取所有用户
    const { data: { users } } = await supabase.auth.admin.listUsers();

    if (users.length > 0) {
      const userId = users[0].id;
      console.log('检查用户ID:', userId);
      console.log('='.repeat(60));

      // 获取 profile 中的积分
      const { data: profile } = await supabase
        .from('profiles')
        .select('points, last_checkin, consecutive_checkin_days')
        .eq('id', userId)
        .single();

      console.log('\n【Profile 表中的数据】');
      console.log('当前积分:', profile?.points);
      console.log('最后签到:', profile?.last_checkin);
      console.log('连续签到天数:', profile?.consecutive_checkin_days);

      // 获取最新的几条交易记录
      const { data: transactions } = await supabase
        .from('point_transactions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(10);

      console.log('\n【最新的10条交易记录】');
      transactions?.forEach((t, idx) => {
        const sign = t.amount > 0 ? '+' : '';
        console.log(`${idx + 1}. ${t.created_at} | ${t.type.padEnd(20)} | ${sign}${t.amount}积分 | 余额: ${t.balance_after} | ${t.description}`);
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

      if (profile?.points !== calculated) {
        console.log('\n⚠️  发现不一致! Profile 积分与交易记录累计不匹配');
        console.log('可能原因:');
        console.log('1. record_point_transaction 函数没有正确更新 profiles 表');
        console.log('2. 有直接修改 profiles.points 的操作没有记录交易');
        console.log('3. 数据库函数版本不是最新的');
      } else {
        console.log('\n✅ 积分数据一致');
      }

      // 检查 record_point_transaction 函数是否存在
      console.log('\n【检查数据库函数】');
      const { data: funcData, error: funcError } = await supabase
        .rpc('record_point_transaction', {
          p_user_id: userId,
          p_amount: 0,
          p_type: 'test',
          p_description: 'test',
          p_related_user_id: null,
          p_related_merchant_id: null,
          p_metadata: null
        })
        .select();

      if (funcError) {
        console.log('❌ 调用 record_point_transaction 失败:', funcError.message);
      } else {
        console.log('✅ record_point_transaction 函数存在且可调用');

        // 删除测试记录
        await supabase
          .from('point_transactions')
          .delete()
          .eq('user_id', userId)
          .eq('type', 'test');
      }

    } else {
      console.log('没有找到用户');
    }
  } catch (error) {
    console.error('错误:', error);
  }
})();
