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
    console.log('开始修复所有用户的积分...\n');

    // 获取所有有交易记录的用户
    const { data: users, error: usersError } = await supabase
      .from('point_transactions')
      .select('user_id')
      .order('user_id');

    if (usersError) {
      throw usersError;
    }

    // 去重
    const uniqueUserIds = [...new Set(users.map(u => u.user_id))];
    console.log(`找到 ${uniqueUserIds.length} 个用户需要检查\n`);

    let fixedCount = 0;
    let correctCount = 0;

    for (const userId of uniqueUserIds) {
      // 计算该用户的正确积分(所有交易的总和)
      const { data: transactions } = await supabase
        .from('point_transactions')
        .select('amount')
        .eq('user_id', userId);

      const correctBalance = transactions.reduce((sum, t) => sum + t.amount, 0);

      // 获取 profile 中的当前积分
      const { data: profile } = await supabase
        .from('profiles')
        .select('points')
        .eq('id', userId)
        .single();

      const currentBalance = profile?.points || 0;

      if (correctBalance !== currentBalance) {
        console.log(`修复用户 ${userId.substring(0, 8)}...`);
        console.log(`  当前积分: ${currentBalance}`);
        console.log(`  正确积分: ${correctBalance}`);
        console.log(`  差异: ${correctBalance - currentBalance}`);

        // 更新为正确的积分
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ points: correctBalance })
          .eq('id', userId);

        if (updateError) {
          console.error(`  ❌ 更新失败:`, updateError.message);
        } else {
          console.log(`  ✅ 已修复\n`);
          fixedCount++;
        }
      } else {
        correctCount++;
      }
    }

    console.log('='.repeat(60));
    console.log(`✅ 修复完成!`);
    console.log(`   - ${correctCount} 个用户积分正确`);
    console.log(`   - ${fixedCount} 个用户积分已修复`);
    console.log('='.repeat(60));

  } catch (error) {
    console.error('❌ 错误:', error.message);
    process.exit(1);
  }
})();
