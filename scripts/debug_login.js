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

async function debugLogin() {
  const env = loadEnv();
  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  const email = 'gbw6hyny82@ozsaip.com';
  const testPassword = 'Test123!@#';

  console.log(`\n=== 调试登录问题 ===`);
  console.log(`邮箱: ${email}`);
  console.log(`测试密码: ${testPassword}\n`);

  // 1. 检查 auth.users
  const { data: authData } = await supabase.auth.admin.listUsers();
  const authUser = authData.users.find(u => u.email === email);

  if (!authUser) {
    console.error('❌ auth.users 中不存在该用户');
    return;
  }

  console.log('✓ auth.users 中存在用户:');
  console.log('  ID:', authUser.id);
  console.log('  Email:', authUser.email);
  console.log('  Email Confirmed:', authUser.email_confirmed_at ? '是' : '否');
  console.log('  Created:', authUser.created_at);
  console.log('  Last Sign In:', authUser.last_sign_in_at || '从未登录');
  console.log('  Confirmation Sent At:', authUser.confirmation_sent_at);
  console.log('  Confirmed At:', authUser.confirmed_at);

  // 2. 尝试使用客户端 Supabase 登录（模拟浏览器行为）
  const clientSupabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  console.log('\n=== 尝试登录 ===');
  const { data: loginData, error: loginError } = await clientSupabase.auth.signInWithPassword({
    email,
    password: testPassword
  });

  if (loginError) {
    console.error('❌ 登录失败:', loginError.message);
    console.error('   错误代码:', loginError.status);
    console.error('   错误详情:', JSON.stringify(loginError, null, 2));

    // 常见错误原因
    if (loginError.message.includes('Email not confirmed')) {
      console.log('\n⚠️  可能原因: 邮箱未确认');
      console.log('   解决方案: 需要确认邮箱或在注册时设置 email_confirm: true');
    } else if (loginError.message.includes('Invalid login credentials')) {
      console.log('\n⚠️  可能原因: 密码不正确或用户不存在');
      console.log('   建议: 检查密码是否正确，或重置密码');
    }
  } else {
    console.log('✅ 登录成功!');
    console.log('   User ID:', loginData.user?.id);
    console.log('   Session:', loginData.session ? '已创建' : '未创建');
  }
}

debugLogin().catch(console.error);
