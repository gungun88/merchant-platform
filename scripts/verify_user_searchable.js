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

async function verifyUserVisible() {
  const env = loadEnv();
  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  const email = '3k9z3reobr@mrotzis.com';

  console.log(`\n=== 验证用户 ${email} 是否可以被搜索到 ===\n`);

  // 模拟管理后台的搜索逻辑
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('email', email)
    .limit(1);

  if (error) {
    console.error('❌ 搜索出错:', error);
    return;
  }

  if (profiles && profiles.length > 0) {
    console.log('✅ 可以通过邮箱搜索到该用户！');
    console.log('\n用户信息:');
    console.log('  - ID:', profiles[0].id);
    console.log('  - 用户编号:', profiles[0].user_number);
    console.log('  - 用户名:', profiles[0].username);
    console.log('  - 邮箱:', profiles[0].email);
    console.log('  - 角色:', profiles[0].role);
    console.log('  - 积分:', profiles[0].points);
    console.log('  - 是否封禁:', profiles[0].is_banned ? '是' : '否');
    console.log('  - 注册时间:', profiles[0].created_at);
  } else {
    console.log('❌ 仍然搜索不到该用户');
  }
}

verifyUserVisible().catch(console.error);
