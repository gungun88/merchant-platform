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

async function checkUserRegistration() {
  const env = loadEnv();
  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  const email = '3k9z3reobr@mrotzis.com';

  console.log(`\n=== 检查用户: ${email} ===\n`);

  // 1. 检查 auth.users 表
  console.log('1. 检查 auth.users 表:');
  const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();

  if (authError) {
    console.error('查询 auth.users 错误:', authError);
  } else {
    const authUser = authUsers.users.find(u => u.email === email);
    if (authUser) {
      console.log('✓ 在 auth.users 中找到用户:');
      console.log('  - ID:', authUser.id);
      console.log('  - Email:', authUser.email);
      console.log('  - Email Confirmed:', authUser.email_confirmed_at ? '是' : '否');
      console.log('  - Created At:', authUser.created_at);
      console.log('  - Last Sign In:', authUser.last_sign_in_at);
    } else {
      console.log('✗ 在 auth.users 中未找到该用户');
    }
  }

  // 2. 检查 public.profiles 表
  console.log('\n2. 检查 public.profiles 表:');
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('email', email)
    .maybeSingle();

  if (profileError) {
    console.error('查询 profiles 错误:', profileError);
  } else if (profile) {
    console.log('✓ 在 profiles 中找到用户:');
    console.log('  - ID:', profile.id);
    console.log('  - Email:', profile.email);
    console.log('  - Username:', profile.username);
    console.log('  - Role:', profile.role);
    console.log('  - Created At:', profile.created_at);
  } else {
    console.log('✗ 在 profiles 中未找到该用户');
  }

  // 3. 如果 auth 中有但 profiles 中没有，这就是问题所在
  if (authUsers && !authError) {
    const authUser = authUsers.users.find(u => u.email === email);
    if (authUser && !profile) {
      console.log('\n⚠️  问题发现:');
      console.log('   用户在 auth.users 中存在，但在 profiles 中不存在！');
      console.log('   这是注册流程的问题，profiles 记录没有创建。');

      // 检查是否有匹配 ID 的 profile
      console.log('\n3. 尝试通过 user_id 查询 profiles:');
      const { data: profileById, error: profileByIdError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .maybeSingle();

      if (profileByIdError) {
        console.error('通过 ID 查询 profiles 错误:', profileByIdError);
      } else if (profileById) {
        console.log('✓ 通过 user_id 找到 profile:');
        console.log('  - Email in profile:', profileById.email);
        console.log('  - Email in auth:', authUser.email);
        if (profileById.email !== authUser.email) {
          console.log('  ⚠️  邮箱不匹配！这可能是问题原因。');
        }
      } else {
        console.log('✗ 通过 user_id 也未找到 profile');
      }
    }
  }

  // 4. 搜索所有 profiles 看看有没有类似的
  console.log('\n4. 搜索 profiles 中类似的邮箱:');
  const { data: similarProfiles, error: similarError } = await supabase
    .from('profiles')
    .select('id, email, username, created_at')
    .ilike('email', '%3k9z3reobr%');

  if (similarError) {
    console.error('搜索相似邮箱错误:', similarError);
  } else if (similarProfiles && similarProfiles.length > 0) {
    console.log(`找到 ${similarProfiles.length} 个相似的 profile:`);
    similarProfiles.forEach(p => {
      console.log(`  - ${p.email} (ID: ${p.id})`);
    });
  } else {
    console.log('未找到相似的 profile');
  }
}

checkUserRegistration().catch(console.error);
