// 检查触发器是否已禁用
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
  envVars.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

async function checkTriggerStatus() {
  console.log('🔍 检查触发器状态...\n')

  try {
    // 尝试创建一个测试用户
    const testEmail = `trigger_test_${Date.now()}@example.com`
    const testPassword = 'test123456'

    console.log('步骤 1: 尝试创建测试用户...')
    console.log('  邮箱:', testEmail)

    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: testEmail,
      password: testPassword,
      email_confirm: true,
      user_metadata: {
        username: 'trigger_test_user'
      }
    })

    if (authError) {
      console.error('❌ 创建用户失败')
      console.error('  错误:', authError.message)
      console.error('  代码:', authError.code)
      console.log('\n💡 触发器可能仍然存在并导致错误')
      console.log('   请确认在 Supabase Dashboard 中执行了:')
      console.log('   DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;')
      return
    }

    console.log('✅ 用户创建成功!')
    console.log('  用户 ID:', authData.user.id)

    // 等待一下
    await new Promise(resolve => setTimeout(resolve, 1000))

    // 检查 profile 是否被触发器自动创建
    console.log('\n步骤 2: 检查 profile 是否被自动创建...')
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', authData.user.id)
      .single()

    if (profile) {
      console.log('⚠️  Profile 被自动创建了')
      console.log('   这意味着触发器仍然存在！')
      console.log('   需要在 Supabase Dashboard 中手动禁用触发器')
    } else {
      console.log('✅ Profile 没有被自动创建')
      console.log('   触发器已成功禁用！')
    }

    // 清理测试用户
    console.log('\n步骤 3: 清理测试用户...')
    await supabase.auth.admin.deleteUser(authData.user.id)
    console.log('✅ 测试用户已删除')

  } catch (err) {
    console.error('❌ 执行出错:', err.message)
  }
}

checkTriggerStatus()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ 执行出错:', err)
    process.exit(1)
  })
