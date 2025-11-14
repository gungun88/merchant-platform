// 检查用户表的可用字段
const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

// 读取 .env.local 文件
const envPath = path.join(__dirname, '..', '.env.local')
const envContent = fs.readFileSync(envPath, 'utf-8')
const envVars = {}

envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/)
  if (match) {
    envVars[match[1].trim()] = match[2].trim()
  }
})

const supabase = createClient(
  envVars.NEXT_PUBLIC_SUPABASE_URL,
  envVars.SUPABASE_SERVICE_ROLE_KEY
)

async function checkUserFields() {
  console.log('检查用户相关表的字段...\n')

  // 1. 查询 profiles 表的一条记录，看看有哪些字段
  const { data: profileSample, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .limit(1)
    .single()

  if (profileError) {
    console.error('查询 profiles 失败:', profileError)
  } else {
    console.log('profiles 表的字段:')
    console.log(Object.keys(profileSample))
    console.log('\n示例数据:')
    console.log(profileSample)
  }

  console.log('\n==========================================\n')

  // 2. 查询 auth.users 表（需要使用 Service Role Key）
  const { data: users, error: usersError } = await supabase.auth.admin.listUsers()

  if (usersError) {
    console.error('查询 auth.users 失败:', usersError)
  } else {
    console.log('auth.users 表的字段 (第一个用户):')
    if (users.users && users.users.length > 0) {
      const firstUser = users.users[0]
      console.log(Object.keys(firstUser))
      console.log('\n示例数据:')
      console.log({
        id: firstUser.id,
        email: firstUser.email,
        phone: firstUser.phone,
        created_at: firstUser.created_at,
        confirmed_at: firstUser.confirmed_at,
        last_sign_in_at: firstUser.last_sign_in_at,
        user_metadata: firstUser.user_metadata,
        app_metadata: firstUser.app_metadata,
      })
    }
  }

  console.log('\n==========================================\n')

  // 3. 检查 merchants 表
  const { data: merchantSample, error: merchantError } = await supabase
    .from('merchants')
    .select('*')
    .limit(1)
    .single()

  if (merchantError) {
    console.error('查询 merchants 失败:', merchantError)
  } else {
    console.log('merchants 表的字段:')
    console.log(Object.keys(merchantSample))
    console.log('\n示例数据:')
    console.log(merchantSample)
  }
}

checkUserFields()
  .then(() => {
    console.log('\n✅ 检查完成')
    process.exit(0)
  })
  .catch((err) => {
    console.error('❌ 执行出错:', err)
    process.exit(1)
  })
