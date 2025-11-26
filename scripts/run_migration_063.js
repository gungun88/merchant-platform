// 执行 SQL 迁移脚本 - 修复注册积分重复发放bug
const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ 缺少环境变量')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function runMigration() {
  try {
    console.log('📝 开始执行迁移: 修复注册积分重复发放bug...\n')

    const sqlPath = path.join(__dirname, '063_fix_duplicate_registration_points.sql')
    const sql = fs.readFileSync(sqlPath, 'utf8')

    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql })

    if (error) {
      console.error('❌ 迁移失败:', error)
      process.exit(1)
    }

    console.log('✅ 迁移执行成功!')
    console.log('\n修复内容:')
    console.log('- 创建 profile 时初始积分设为 0')
    console.log('- 然后通过 record_point_transaction 正确增加注册奖励积分')
    console.log('- 这样积分交易记录和用户积分余额就能正确对应了')

  } catch (err) {
    console.error('❌ 执行错误:', err)
    process.exit(1)
  }
}

runMigration()
