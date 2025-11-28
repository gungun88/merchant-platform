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

async function checkUser() {
  const env = loadEnv();
  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  const email = 'gbw6hyny82@ozsaip.com';

  console.log(`\n=== 检查用户: ${email} ===\n`);

  // 检查 auth.users
  const { data: authData } = await supabase.auth.admin.listUsers();
  const authUser = authData.users.find(u => u.email === email);

  if (authUser) {
    console.log('✓ 在 auth.users 中找到:');
    console.log('  ID:', authUser.id);
    console.log('  Email:', authUser.email);
    console.log('  Created:', authUser.created_at);
  } else {
    console.log('✗ 在 auth.users 中未找到');
  }

  // 检查 profiles
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('email', email)
    .maybeSingle();

  if (error) {
    console.error('\n✗ 查询 profiles 错误:', error);
  } else if (profile) {
    console.log('\n✓ 在 profiles 中找到:');
    console.log('  ID:', profile.id);
    console.log('  Email:', profile.email);
    console.log('  Username:', profile.username);
    console.log('  User Number:', profile.user_number);
    console.log('  Login Failed Attempts:', profile.login_failed_attempts);
    console.log('  Account Locked Until:', profile.account_locked_until);
  } else {
    console.log('\n✗ 在 profiles 中未找到');
  }

  // 尝试登录
  console.log('\n=== 尝试使用 Supabase Auth 登录 ===');
  // 注意：这里不能测试登录，因为我们不知道密码
  console.log('提示：如果密码正确但登录失败，可能是 profile 不存在导致的');
}

checkUser().catch(console.error);
