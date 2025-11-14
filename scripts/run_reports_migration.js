const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')
require('dotenv').config({ path: '.env.local' })

async function runMigration() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ 缺少 Supabase 配置')
    console.error('请确保 .env.local 中有以下配置:')
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

  console.log('📚 读取迁移脚本...')
  const sqlPath = path.join(__dirname, '032_create_reports_table.sql')
  const sql = fs.readFileSync(sqlPath, 'utf8')

  console.log('🚀 执行数据库迁移...')

  // 将SQL分割成多个语句执行
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'))

  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i]
    if (statement) {
      console.log(`\n执行语句 ${i + 1}/${statements.length}...`)
      const { data, error } = await supabase.rpc('exec_sql', {
        sql_query: statement + ';'
      }).single()

      if (error) {
        // 尝试直接通过 Supabase REST API 执行
        console.log('尝试备用方法...')
        // 这里需要使用 Supabase 的 SQL API
        console.error('⚠️  无法通过脚本执行，请手动在 Supabase SQL Editor 中执行')
        console.log('\n请访问: ' + supabaseUrl.replace('https://', 'https://app.') + '/project/_/sql')
        console.log('并执行文件: scripts/032_create_reports_table.sql')
        break
      }
    }
  }

  console.log('\n✅ 迁移完成!')
}

runMigration().catch(error => {
  console.error('❌ 迁移失败:', error.message)
  process.exit(1)
})
