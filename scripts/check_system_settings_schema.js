/**
 * 检查 system_settings 表结构
 * 验证所有必需的字段是否存在
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
    const key = match[1].trim()
    const value = match[2].trim()
    envVars[key] = value
  }
})

const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = envVars.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ 缺少 Supabase 配置')
  console.error('需要在 .env.local 中配置:')
  console.error('  - NEXT_PUBLIC_SUPABASE_URL')
  console.error('  - SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function checkSchema() {
  console.log('🔍 检查 system_settings 表结构...\n')

  // 检查表是否存在
  const { data: tables, error: tablesError } = await supabase
    .from('information_schema.tables')
    .select('table_name')
    .eq('table_schema', 'public')
    .eq('table_name', 'system_settings')

  if (tablesError) {
    console.error('❌ 查询表信息失败:', tablesError)
    return
  }

  if (!tables || tables.length === 0) {
    console.error('❌ system_settings 表不存在！')
    console.error('请先在 Supabase Dashboard 的 SQL Editor 中执行以下脚本:')
    console.error('  - scripts/045_create_system_settings_table.sql')
    console.error('  - scripts/047_add_missing_point_fields.sql')
    return
  }

  console.log('✅ system_settings 表存在\n')

  // 检查表的所有字段
  const { data: columns, error: columnsError } = await supabase
    .from('information_schema.columns')
    .select('column_name, data_type, column_default')
    .eq('table_schema', 'public')
    .eq('table_name', 'system_settings')
    .order('ordinal_position')

  if (columnsError) {
    console.error('❌ 查询字段信息失败:', columnsError)
    return
  }

  console.log('📋 当前表结构:')
  console.log('-'.repeat(80))
  columns.forEach(col => {
    console.log(`  ${col.column_name.padEnd(35)} ${col.data_type.padEnd(20)} ${col.column_default || ''}`)
  })
  console.log('-'.repeat(80))
  console.log()

  // 检查必需的积分字段
  const requiredColumns = [
    'checkin_points',
    'invitation_points',
    'register_points',
    'merchant_register_points',
    'edit_merchant_cost',
    'upload_avatar_reward',
    'deposit_merchant_daily_reward',
    'deposit_merchant_apply_reward',
    'merchant_top_cost_per_day'
  ]

  const existingColumns = columns.map(c => c.column_name)
  const missingColumns = requiredColumns.filter(col => !existingColumns.includes(col))

  if (missingColumns.length > 0) {
    console.error('❌ 缺少以下字段:')
    missingColumns.forEach(col => {
      console.error(`   - ${col}`)
    })
    console.error('\n请在 Supabase Dashboard 的 SQL Editor 中执行:')
    console.error('   scripts/047_add_missing_point_fields.sql')
  } else {
    console.log('✅ 所有必需的积分字段都存在')
  }

  // 检查是否有数据
  console.log('\n📊 检查数据...')
  const { data: settings, error: dataError } = await supabase
    .from('system_settings')
    .select('*')
    .single()

  if (dataError) {
    console.error('❌ 读取数据失败:', dataError.message)
    if (dataError.code === 'PGRST116') {
      console.error('表中没有数据，需要初始化系统设置')
    }
  } else {
    console.log('✅ 系统设置数据存在\n')
    console.log('当前积分配置:')
    console.log('-'.repeat(80))
    console.log(`  签到奖励:                    ${settings.checkin_points || 'N/A'} 积分/次`)
    console.log(`  注册奖励:                    ${settings.register_points || 'N/A'} 积分`)
    console.log(`  邀请奖励:                    ${settings.invitation_points || 'N/A'} 积分`)
    console.log(`  商家注册奖励:                ${settings.merchant_register_points || 'N/A'} 积分`)
    console.log(`  编辑商家费用:                ${settings.edit_merchant_cost || 'N/A'} 积分`)
    console.log(`  首次上传头像奖励:            ${settings.upload_avatar_reward || 'N/A'} 积分`)
    console.log(`  押金商家每日登录奖励:        ${settings.deposit_merchant_daily_reward || 'N/A'} 积分`)
    console.log(`  押金商家审核通过奖励:        ${settings.deposit_merchant_apply_reward || 'N/A'} 积分`)
    console.log(`  商家置顶费用:                ${settings.merchant_top_cost_per_day || 'N/A'} 积分/天`)
    console.log('-'.repeat(80))
  }

  console.log('\n✅ 检查完成!')
  console.log('\n💡 如果 PostgREST 缓存问题仍然存在，请在 Supabase Dashboard SQL Editor 执行:')
  console.log('   NOTIFY pgrst, \'reload schema\';')
}

checkSchema().catch(console.error)
