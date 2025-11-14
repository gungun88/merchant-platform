// 直接测试创建用户，绕过触发器
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

async function testCreateUser() {
  console.log('🧪 测试创建用户...\n')

  const testEmail = `test_${Date.now()}@example.com`
  const testUsername = `test_user_${Date.now()}`
  const testPassword = 'test123456'

  try {
    console.log('步骤 1: 创建认证用户...')
    console.log('  邮箱:', testEmail)
    console.log('  用户名:', testUsername)
    console.log('  密码:', testPassword)
    console.log('')

    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: testEmail,
      password: testPassword,
      email_confirm: true,
      user_metadata: {
        username: testUsername
      }
    })

    if (authError) {
      console.error('❌ 创建用户失败')
      console.error('错误代码:', authError.code)
      console.error('错误消息:', authError.message)
      console.error('错误状态:', authError.status)
      console.error('完整错误:', JSON.stringify(authError, null, 2))

      // 尝试获取更多细节
      if (authError.message.includes('Database error')) {
        console.log('\n💡 这是一个数据库触发器错误')
        console.log('   可能原因:')
        console.log('   1. profiles 表缺少必填字段')
        console.log('   2. 触发器函数中有语法错误')
        console.log('   3. 触发器依赖的函数不存在或有错误')
        console.log('\n   建议: 查看 Supabase Dashboard > Database > Logs')
      }

      return
    }

    console.log('✅ 用户创建成功!')
    console.log('   用户 ID:', authData.user.id)
    console.log('   邮箱:', authData.user.email)

    // 等待一下让触发器执行
    console.log('\n步骤 2: 等待触发器执行 (3秒)...')
    await new Promise(resolve => setTimeout(resolve, 3000))

    // 检查 profile 是否创建
    console.log('\n步骤 3: 检查 profile 是否创建...')
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authData.user.id)
      .single()

    if (profileError) {
      console.error('❌ Profile 查询失败:', profileError.message)
    } else if (!profile) {
      console.error('❌ Profile 不存在')
    } else {
      console.log('✅ Profile 已创建:')
      console.log('   用户名:', profile.username)
      console.log('   积分:', profile.points)
      console.log('   邀请码:', profile.invitation_code)
    }

    // 检查积分交易记录
    console.log('\n步骤 4: 检查积分交易记录...')
    const { data: transactions, error: txError } = await supabase
      .from('point_transactions')
      .select('*')
      .eq('user_id', authData.user.id)

    if (txError) {
      console.error('❌ 积分交易查询失败:', txError.message)
    } else if (!transactions || transactions.length === 0) {
      console.error('❌ 没有积分交易记录')
    } else {
      console.log('✅ 找到', transactions.length, '条积分交易记录')
      transactions.forEach(tx => {
        console.log('   -', tx.type, ':', tx.amount, '积分')
      })
    }

    // 检查通知
    console.log('\n步骤 5: 检查通知...')
    const { data: notifications, error: notifError } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', authData.user.id)

    if (notifError) {
      console.error('❌ 通知查询失败:', notifError.message)
    } else if (!notifications || notifications.length === 0) {
      console.error('❌ 没有通知记录')
    } else {
      console.log('✅ 找到', notifications.length, '条通知')
      notifications.forEach(n => {
        console.log('   -', n.title, ':', n.content)
      })
    }

    console.log('\n✅ 测试完成!')
    console.log('\n📋 总结:')
    console.log('- 用户创建:', authData.user ? '✅' : '❌')
    console.log('- Profile 创建:', profile ? '✅' : '❌')
    console.log('- 积分记录:', transactions && transactions.length > 0 ? '✅' : '❌')
    console.log('- 通知记录:', notifications && notifications.length > 0 ? '✅' : '❌')

  } catch (err) {
    console.error('❌ 测试失败:', err.message)
    console.error(err)
  }
}

testCreateUser()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ 执行出错:', err)
    process.exit(1)
  })
