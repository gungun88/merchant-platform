/**
 * 检查数据库中是否存在必要的函数
 */

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
  console.log('🔍 检查数据库函数...\n')

  // 方法1: 尝试直接调用函数
  console.log('1️⃣ 测试 now() 函数:')
  const { data: nowData, error: nowError } = await supabase.rpc('now')
  if (nowError) {
    console.log('   ❌ 不存在或无权限')
    console.log('   错误:', nowError.message)
  } else {
    console.log('   ✅ 存在且可调用')
    console.log('   返回值:', nowData)
  }

  console.log('\n2️⃣ 测试 record_point_transaction() 函数:')
  // 只是检查函数是否存在,不实际执行
  const { data: recordData, error: recordError } = await supabase.rpc('record_point_transaction', {
    p_user_id: '00000000-0000-0000-0000-000000000000',
    p_amount: 0,
    p_type: 'test',
    p_description: 'test'
  })

  if (recordError) {
    if (recordError.message.includes('not find the function')) {
      console.log('   ❌ 函数不存在')
    } else if (recordError.message.includes('用户不存在')) {
      console.log('   ✅ 函数存在(测试用户ID不存在,这是正常的)')
    } else {
      console.log('   ⚠️  函数可能存在,但执行出错')
      console.log('   错误:', recordError.message)
    }
  } else {
    console.log('   ✅ 函数存在且可调用')
  }

  console.log('\n===========================================')
  console.log('结论:')
  console.log('===========================================')

  if (!nowError && recordError && recordError.message.includes('用户不存在')) {
    console.log('✅ 开发环境函数完整')
    console.log('   - now() 函数: 存在')
    console.log('   - record_point_transaction() 函数: 存在')
  } else if (nowError && recordError && recordError.message.includes('not find')) {
    console.log('❌ 开发环境缺少函数')
    console.log('   - now() 函数: 缺失')
    console.log('   - record_point_transaction() 函数: 缺失')
    console.log('\n💡 建议: 在开发环境执行 085 或 089 号脚本')
  } else {
    console.log('⚠️  部分函数存在')
    console.log('   - now() 函数:', nowError ? '❌ 缺失' : '✅ 存在')
    console.log('   - record_point_transaction() 函数:', recordError && recordError.message.includes('not find') ? '❌ 缺失' : '✅ 存在')
  }
}

checkFunctions()
  .then(() => {
    console.log('\n✅ 检查完成')
    process.exit(0)
  })
  .catch((err) => {
    console.error('❌ 执行出错:', err)
    process.exit(1)
  })
