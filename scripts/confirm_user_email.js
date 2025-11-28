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

async function confirmUserEmail() {
  const env = loadEnv();
  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  const email = 'gbw6hyny82@ozsaip.com';

  console.log(`\n=== 确认用户邮箱 ===`);
  console.log(`邮箱: ${email}\n`);

  // 1. 获取用户
  const { data: authData } = await supabase.auth.admin.listUsers();
  const user = authData.users.find(u => u.email === email);

  if (!user) {
    console.error('❌ 用户不存在');
    return;
  }

  console.log('用户ID:', user.id);
  console.log('邮箱确认状态（修改前）:', user.email_confirmed_at ? '已确认' : '未确认');

  // 2. 手动确认邮箱
  const { data, error } = await supabase.auth.admin.updateUserById(
    user.id,
    { email_confirm: true }
  );

  if (error) {
    console.error('\n❌ 确认邮箱失败:', error);
    return;
  }

  console.log('\n✅ 邮箱已确认！');
  console.log('邮箱确认状态（修改后）:', data.user.email_confirmed_at ? '已确认' : '未确认');
  console.log('确认时间:', data.user.email_confirmed_at);

  console.log('\n现在可以正常登录了！');
}

confirmUserEmail().catch(console.error);
