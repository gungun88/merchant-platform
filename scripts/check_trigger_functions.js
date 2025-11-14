// 检查数据库触发器和函数是否正常
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

async function checkFunctions() {
  console.log('🔍 检查数据库触发器和函数...\n')

  try {
    // 1. 检查 record_point_transaction 函数
    console.log('步骤 1: 检查 record_point_transaction 函数...')
    const { data: pointFunc, error: pointFuncError } = await supabase
      .rpc('record_point_transaction', {
        p_user_id: '00000000-0000-0000-0000-000000000000', // 假的UUID用于测试
        p_amount: 100,
        p_type: 'test',
        p_description: 'test'
      })
      .then(
        () => ({ data: true, error: null }),
        (err) => ({ data: null, error: err })
      )

    if (pointFuncError && !pointFuncError.message.includes('User profile not found')) {
      console.log('❌ record_point_transaction 函数不存在或有错误')
      console.log('   错误信息:', pointFuncError.message)
    } else {
      console.log('✅ record_point_transaction 函数存在')
    }

    // 2. 检查 create_notification 函数
    console.log('\n步骤 2: 检查 create_notification 函数...')
    const { data: notifFunc, error: notifFuncError } = await supabase
      .rpc('create_notification', {
        p_user_id: '00000000-0000-0000-0000-000000000000',
        p_type: 'test',
        p_category: 'test',
        p_title: 'test'
      })
      .then(
        () => ({ data: true, error: null }),
        (err) => ({ data: null, error: err })
      )

    if (notifFuncError && !notifFuncError.message.includes('violates foreign key')) {
      console.log('❌ create_notification 函数不存在或有错误')
      console.log('   错误信息:', notifFuncError.message)
    } else {
      console.log('✅ create_notification 函数存在')
    }

    // 3. 检查 generate_invitation_code 函数
    console.log('\n步骤 3: 检查 generate_invitation_code 函数...')
    const { data: inviteFunc, error: inviteFuncError } = await supabase
      .rpc('generate_invitation_code')

    if (inviteFuncError) {
      console.log('❌ generate_invitation_code 函数不存在或有错误')
      console.log('   错误信息:', inviteFuncError.message)
    } else {
      console.log('✅ generate_invitation_code 函数存在')
      console.log('   生成的邀请码示例:', inviteFunc)
    }

    // 4. 检查 system_settings 表
    console.log('\n步骤 4: 检查 system_settings 表...')
    const { data: settings, error: settingsError } = await supabase
      .from('system_settings')
      .select('register_points')
      .eq('id', '00000000-0000-0000-0000-000000000001')
      .single()

    if (settingsError) {
      console.log('❌ 无法读取 system_settings 表')
      console.log('   错误信息:', settingsError.message)
    } else {
      console.log('✅ system_settings 表正常')
      console.log('   注册积分设置:', settings.register_points)
    }

    console.log('\n✅ 检查完成!')
    console.log('\n📋 建议:')
    console.log('1. 如果所有函数都存在，问题可能出在触发器执行时序上')
    console.log('2. 检查是否有其他数据库错误日志')
    console.log('3. 尝试在 Supabase Dashboard 的 SQL Editor 中手动创建用户测试')

  } catch (err) {
    console.error('❌ 执行出错:', err.message)
  }
}

checkFunctions()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ 执行出错:', err)
    process.exit(1)
  })
