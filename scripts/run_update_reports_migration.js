const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

// 读取 .env.local 文件
function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env.local')
  const envContent = fs.readFileSync(envPath, 'utf8')
  const env = {}
  envContent.split('\n').forEach(line => {
    const [key, ...values] = line.split('=')
    if (key && values.length > 0) {
      env[key.trim()] = values.join('=').trim()
    }
  })
  return env
}

async function updateReportsTable() {
  const env = loadEnv()
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ 缺少 Supabase 配置')
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })

  console.log('📚 读取迁移脚本...\n')
  const sqlPath = path.join(__dirname, '033_update_reports_table.sql')
  const sql = fs.readFileSync(sqlPath, 'utf8')

  console.log('🚀 执行数据库迁移...\n')
  console.log('⚠️  警告：此脚本将修改 reports 表结构')
  console.log('请确保已备份重要数据\n')

  try {
    // 获取当前表结构
    const { data: beforeColumns, error: beforeError } = await supabase
      .from('reports')
      .select('*')
      .limit(1)

    if (!beforeError && beforeColumns && beforeColumns.length > 0) {
      console.log('📋 迁移前的字段:')
      Object.keys(beforeColumns[0]).forEach(field => {
        console.log(`  - ${field}`)
      })
      console.log('')
    }

    // 分段执行SQL
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'))

    console.log(`准备执行 ${statements.length} 个SQL语句...\n`)

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i]
      if (statement && statement.trim().length > 0) {
        console.log(`执行语句 ${i + 1}/${statements.length}...`)

        // 显示正在执行的语句摘要
        const preview = statement.substring(0, 80).replace(/\s+/g, ' ')
        console.log(`  ${preview}${statement.length > 80 ? '...' : ''}`)

        // Supabase 不支持 rpc('exec_sql')，我们需要使用 Supabase SQL Editor
        // 这里我们只是输出提示
      }
    }

    console.log('\n⚠️  由于 Supabase 限制，无法通过脚本直接执行 ALTER TABLE')
    console.log('\n📝 请按以下步骤手动执行迁移:')
    console.log('1. 访问 Supabase SQL Editor:')
    console.log(`   ${supabaseUrl.replace('https://', 'https://supabase.com/dashboard/project/').replace('.supabase.co', '')}/sql`)
    console.log('2. 复制文件内容: scripts/033_update_reports_table.sql')
    console.log('3. 粘贴到 SQL Editor 并执行')
    console.log('4. 执行完成后，运行验证脚本: node scripts/verify_reports_structure.js\n')

  } catch (error) {
    console.error('❌ 执行失败:', error.message)
    process.exit(1)
  }
}

updateReportsTable().catch(error => {
  console.error('❌ 脚本执行失败:', error.message)
  process.exit(1)
})
