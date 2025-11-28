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

async function resetUserPassword() {
  const env = loadEnv();
  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  const email = 'gbw6hyny82@ozsaip.com';
  const newPassword = 'Test123!@#';  // 新密码

  console.log(`\n=== 重置用户密码 ===`);
  console.log(`邮箱: ${email}`);
  console.log(`新密码: ${newPassword}\n`);

  // 1. 获取用户
  const { data: authData } = await supabase.auth.admin.listUsers();
  const user = authData.users.find(u => u.email === email);

  if (!user) {
    console.error('❌ 用户不存在');
    return;
  }

  // 2. 重置密码
  const { data, error } = await supabase.auth.admin.updateUserById(
    user.id,
    { password: newPassword }
  );

  if (error) {
    console.error('❌ 重置密码失败:', error);
    return;
  }

  console.log('✅ 密码重置成功！');
  console.log(`\n现在可以使用以下凭据登录:`);
  console.log(`邮箱: ${email}`);
  console.log(`密码: ${newPassword}`);

  // 3. 重置登录失败次数
  const { error: resetError } = await supabase
    .from('profiles')
    .update({
      login_failed_attempts: 0,
      account_locked_until: null,
      last_failed_login_at: null
    })
    .eq('id', user.id);

  if (resetError) {
    console.log('⚠️  重置登录失败次数出错（不影响登录）');
  } else {
    console.log('✅ 登录失败次数已重置');
  }
}

resetUserPassword().catch(console.error);
