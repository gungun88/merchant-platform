// 测试 Service Role Key
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

console.log('✅ Environment variables loaded:')
console.log('NEXT_PUBLIC_SUPABASE_URL:', envVars.NEXT_PUBLIC_SUPABASE_URL)
console.log('SUPABASE_SERVICE_ROLE_KEY (first 20 chars):', envVars.SUPABASE_SERVICE_ROLE_KEY?.substring(0, 20) + '...')

// 创建管理员客户端
const supabase = createClient(
  envVars.NEXT_PUBLIC_SUPABASE_URL,
  envVars.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

async function testAdminAccess() {
  console.log('\n🔄 Testing admin access...')

  try {
    // 尝试使用 admin API
    const { data, error } = await supabase.auth.admin.listUsers()

    if (error) {
      console.error('❌ Admin access test failed:', error)
      return false
    }

    console.log('✅ Admin access works! Found', data.users.length, 'users')
    return true
  } catch (err) {
    console.error('❌ Exception during test:', err.message)
    return false
  }
}

testAdminAccess()
  .then(success => {
    if (success) {
      console.log('\n✅ Service Role Key is valid and working!')
    } else {
      console.log('\n❌ Service Role Key is not working properly')
      console.log('\n💡 Please check:')
      console.log('1. The SUPABASE_SERVICE_ROLE_KEY in .env.local')
      console.log('2. Your Supabase project settings')
    }
    process.exit(success ? 0 : 1)
  })
