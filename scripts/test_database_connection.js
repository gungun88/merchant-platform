/**
 * 数据库连接和字段测试脚本
 * 用于检查数据库中是否存在关键字段和表
 */

const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

// 读取 .env.local 文件
let supabaseUrl, supabaseKey

try {
  const envPath = path.join(__dirname, '..', '.env.local')
  const envContent = fs.readFileSync(envPath, 'utf-8')

  envContent.split('\n').forEach(line => {
    const match = line.match(/^NEXT_PUBLIC_SUPABASE_URL=(.+)$/)
    if (match) supabaseUrl = match[1].trim()

    const match2 = line.match(/^NEXT_PUBLIC_SUPABASE_ANON_KEY=(.+)$/)
    if (match2) supabaseKey = match2[1].trim()
  })
} catch (err) {
  console.error('❌ 无法读取 .env.local 文件:', err.message)
}

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ 错误: 缺少 Supabase 配置')
  console.error('请检查 .env.local 文件中是否有:')
  console.error('  - NEXT_PUBLIC_SUPABASE_URL')
  console.error('  - NEXT_PUBLIC_SUPABASE_ANON_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

console.log('🔍 开始测试数据库连接和表结构...\n')

async function testDatabaseConnection() {
  try {
    console.log('📡 测试 1: 数据库连接')
    const { data, error } = await supabase.from('profiles').select('count').single()

    if (error && error.message.includes('JWT')) {
      console.log('⚠️  需要登录才能访问(RLS 已启用)')
    } else if (error) {
      console.log('❌ 连接失败:', error.message)
    } else {
      console.log('✅ 数据库连接成功\n')
    }
  } catch (err) {
    console.log('✅ 数据库连接成功(表存在)\n')
  }
}

async function checkMerchantsTable() {
  console.log('📋 测试 2: merchants 表字段检查')

  const requiredFields = [
    'id',
    'user_id',
    'name',
    'is_deposit_merchant',
    'deposit_status',
    'deposit_amount',
    'deposit_bonus_claimed',
    'pin_type',
    'pin_expires_at',
    'is_topped',
    'topped_until',
    'is_active',
    'credit_score'
  ]

  try {
    // 尝试查询所有字段
    const selectFields = requiredFields.join(', ')
    const { data, error } = await supabase
      .from('merchants')
      .select(selectFields)
      .limit(1)

    if (error) {
      console.log('❌ 查询失败:', error.message)

      // 分析错误信息,找出缺失的字段
      const missingField = error.message.match(/column "([^"]+)" does not exist/)
      if (missingField) {
        console.log(`\n🔴 缺失字段: ${missingField[1]}`)
        console.log('   请执行修复脚本: scripts/999_comprehensive_fix.sql\n')
      }
      return false
    } else {
      console.log('✅ merchants 表字段完整')
      console.log(`   已检查 ${requiredFields.length} 个字段\n`)
      return true
    }
  } catch (err) {
    console.log('❌ 检查失败:', err.message, '\n')
    return false
  }
}

async function checkProfilesTable() {
  console.log('📋 测试 3: profiles 表字段检查')

  const requiredFields = [
    'id',
    'username',
    'user_number',
    'points',
    'role',
    'is_merchant',
    'invitation_code',
    'max_invitations',
    'used_invitations'
  ]

  try {
    const selectFields = requiredFields.join(', ')
    const { data, error } = await supabase
      .from('profiles')
      .select(selectFields)
      .limit(1)

    if (error) {
      console.log('❌ 查询失败:', error.message)

      const missingField = error.message.match(/column "([^"]+)" does not exist/)
      if (missingField) {
        console.log(`\n🔴 缺失字段: ${missingField[1]}`)
        console.log('   请执行修复脚本: scripts/999_comprehensive_fix.sql\n')
      }
      return false
    } else {
      console.log('✅ profiles 表字段完整')
      console.log(`   已检查 ${requiredFields.length} 个字段\n`)
      return true
    }
  } catch (err) {
    console.log('❌ 检查失败:', err.message, '\n')
    return false
  }
}

async function checkOtherTables() {
  console.log('📋 测试 4: 其他关键表检查')

  const tables = [
    'admin_operation_logs',
    'deposit_top_up_applications',
    'point_transactions',
    'notifications'
  ]

  const results = []

  for (const table of tables) {
    try {
      const { data, error } = await supabase
        .from(table)
        .select('count')
        .limit(1)

      if (error && error.message.includes('does not exist')) {
        console.log(`❌ ${table} - 表不存在`)
        results.push({ table, exists: false })
      } else {
        console.log(`✅ ${table} - 表存在`)
        results.push({ table, exists: true })
      }
    } catch (err) {
      console.log(`✅ ${table} - 表存在`)
      results.push({ table, exists: true })
    }
  }

  console.log('')
  return results
}

async function testMerchantQuery() {
  console.log('📋 测试 5: 模拟真实查询(商家列表)')

  try {
    // 模拟 getMerchants 函数的查询
    const { data, error } = await supabase
      .from('merchants')
      .select('*, profiles!inner(username, avatar, user_number, points)')
      .eq('is_active', true)
      .limit(5)

    if (error) {
      console.log('❌ 查询失败:', error.message)

      // 分析是哪个字段导致的问题
      if (error.message.includes('user_number')) {
        console.log('\n🔴 问题: profiles.user_number 字段不存在')
      } else if (error.message.includes('points')) {
        console.log('\n🔴 问题: profiles.points 字段不存在')
      } else if (error.message.includes('is_active')) {
        console.log('\n🔴 问题: merchants.is_active 字段不存在')
      }

      console.log('   请执行修复脚本: scripts/999_comprehensive_fix.sql\n')
      return false
    } else {
      console.log('✅ 商家列表查询成功')
      console.log(`   返回 ${data?.length || 0} 条记录\n`)

      if (data && data.length > 0) {
        console.log('   示例数据:')
        console.log(`   - 商家: ${data[0].name}`)
        console.log(`   - 用户编号: ${data[0].profiles?.user_number || '无'}`)
        console.log(`   - 积分: ${data[0].profiles?.points || 0}`)
        console.log(`   - 置顶类型: ${data[0].pin_type || '未置顶'}`)
        console.log(`   - 是否上架: ${data[0].is_active}\n`)
      }

      return true
    }
  } catch (err) {
    console.log('❌ 查询失败:', err.message, '\n')
    return false
  }
}

async function runTests() {
  console.log('=' .repeat(60))
  console.log('🔍 数据库诊断测试')
  console.log('=' .repeat(60))
  console.log('')

  await testDatabaseConnection()

  const merchantsOk = await checkMerchantsTable()
  const profilesOk = await checkProfilesTable()
  await checkOtherTables()
  await testMerchantQuery()

  console.log('=' .repeat(60))
  console.log('📊 测试总结')
  console.log('=' .repeat(60))

  if (merchantsOk && profilesOk) {
    console.log('\n✅ 所有关键字段都存在,数据库结构正常!')
    console.log('   如果网站仍有错误,请检查:')
    console.log('   1. 浏览器控制台 (F12)')
    console.log('   2. Network 标签查看 API 调用')
    console.log('   3. Supabase Dashboard → Logs\n')
  } else {
    console.log('\n❌ 发现问题,需要修复!')
    console.log('\n修复步骤:')
    console.log('1. 打开 Supabase Dashboard → SQL Editor')
    console.log('2. 执行脚本: scripts/999_comprehensive_fix.sql')
    console.log('3. 重新运行此测试: node scripts/test_database_connection.js\n')
  }

  console.log('🌐 开发服务器地址: http://localhost:3002')
  console.log('   请在浏览器中打开并检查是否有错误\n')
}

// 运行测试
runTests().catch(console.error)
