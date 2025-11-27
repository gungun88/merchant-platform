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

async function checkOrphanUsers() {
  const env = loadEnv();
  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  console.log('\n=== 检查孤立用户（auth 中有但 profile 中没有） ===\n');

  // 1. 获取所有 auth 用户
  const { data: authData, error: authError } = await supabase.auth.admin.listUsers();

  if (authError) {
    console.error('❌ 获取 auth 用户失败:', authError);
    return;
  }

  console.log(`✓ 找到 ${authData.users.length} 个 auth 用户`);

  // 2. 获取所有 profiles
  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('id');

  if (profileError) {
    console.error('❌ 获取 profiles 失败:', profileError);
    return;
  }

  console.log(`✓ 找到 ${profiles.length} 个 profile 记录`);

  // 3. 找出孤立用户（在 auth 中但不在 profiles 中）
  const profileIds = new Set(profiles.map(p => p.id));
  const orphanUsers = authData.users.filter(user => !profileIds.has(user.id));

  console.log(`\n=== 检查结果 ===\n`);

  if (orphanUsers.length === 0) {
    console.log('✅ 没有发现孤立用户，所有 auth 用户都有对应的 profile！');
    return;
  }

  console.log(`⚠️  发现 ${orphanUsers.length} 个孤立用户:\n`);

  orphanUsers.forEach((user, index) => {
    console.log(`${index + 1}. 用户 ID: ${user.id}`);
    console.log(`   - Email: ${user.email}`);
    console.log(`   - Username: ${user.user_metadata?.username || '(未设置)'}`);
    console.log(`   - 创建时间: ${user.created_at}`);
    console.log(`   - 最后登录: ${user.last_sign_in_at || '(从未登录)'}`);
    console.log(`   - 邮箱确认: ${user.email_confirmed_at ? '是' : '否'}`);
    console.log('');
  });

  console.log(`\n建议：运行修复脚本为这 ${orphanUsers.length} 个用户创建 profile\n`);

  // 保存孤立用户列表到文件
  const outputPath = path.join(__dirname, 'orphan_users.json');
  fs.writeFileSync(outputPath, JSON.stringify(orphanUsers, null, 2));
  console.log(`孤立用户列表已保存到: ${outputPath}`);
}

checkOrphanUsers().catch(console.error);
