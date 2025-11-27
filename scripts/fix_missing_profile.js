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

async function fixMissingProfile() {
  const env = loadEnv();
  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  const userId = 'd6123696-9c4c-4615-a090-d283da752ad4';
  const email = '3k9z3reobr@mrotzis.com';

  console.log(`\n=== 修复用户 ${email} 的 profile ===\n`);

  // 1. 从 auth.users 获取用户信息
  const { data: authData } = await supabase.auth.admin.listUsers();
  const authUser = authData.users.find(u => u.id === userId);

  if (!authUser) {
    console.error('❌ 在 auth.users 中未找到用户');
    return;
  }

  console.log('✓ 找到 auth 用户:');
  console.log('  - ID:', authUser.id);
  console.log('  - Email:', authUser.email);
  console.log('  - Created At:', authUser.created_at);
  console.log('  - User Metadata:', JSON.stringify(authUser.user_metadata, null, 2));

  // 2. 生成用户名（从 metadata 中获取，或使用默认值）
  const username = authUser.user_metadata?.username || `用户_${email.split('@')[0]}`;

  console.log(`\n准备创建 profile:`);
  console.log('  - Username:', username);
  console.log('  - Email:', email);

  // 3. 获取当前最大的 user_number
  const { data: maxUserNumber } = await supabase
    .from('profiles')
    .select('user_number')
    .order('user_number', { ascending: false })
    .limit(1);

  const nextUserNumber = (maxUserNumber && maxUserNumber.length > 0)
    ? maxUserNumber[0].user_number + 1
    : 1;

  console.log('  - User Number:', nextUserNumber);

  // 4. 创建 profile 记录
  const { data: newProfile, error: insertError } = await supabase
    .from('profiles')
    .insert({
      id: userId,
      username: username,
      email: email,
      user_number: nextUserNumber,
      role: 'user',
      is_banned: false,
      points: 0,
      report_count: 0,
      created_at: authUser.created_at,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (insertError) {
    console.error('\n❌ 创建 profile 失败:', insertError);
    return;
  }

  console.log('\n✅ Profile 创建成功!');
  console.log('详细信息:', JSON.stringify(newProfile, null, 2));

  // 5. 验证创建结果
  console.log('\n=== 验证修复结果 ===\n');

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (profile) {
    console.log('✓ profiles 表中已存在该用户记录');
    console.log('  - ID:', profile.id);
    console.log('  - User Number:', profile.user_number);
    console.log('  - Username:', profile.username);
    console.log('  - Email:', profile.email);
    console.log('  - Role:', profile.role);
    console.log('  - Points:', profile.points);
    console.log('\n🎉 修复完成! 现在该用户应该可以在管理后台搜索到了。');
  } else {
    console.log('❌ 验证失败，profile 仍然不存在');
  }
}

fixMissingProfile().catch(console.error);
