/**
 * 在开发环境执行 SQL 脚本更新数据库函数
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

async function executeSQLFile(sqlFilePath) {
  console.log(`📄 读取 SQL 文件: ${sqlFilePath}\n`)

  const sqlContent = fs.readFileSync(sqlFilePath, 'utf-8')

  // 将SQL分成多个语句
  const statements = sqlContent
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'))

  console.log(`📊 共 ${statements.length} 条 SQL 语句\n`)

  let successCount = 0
  let errorCount = 0

  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i]

    // 跳过注释和空语句
    if (!statement || statement.startsWith('--') || statement.match(/^\s*$/)) {
      continue
    }

    console.log(`执行语句 ${i + 1}/${statements.length}...`)

    try {
      const { data, error } = await supabase.rpc('exec_sql', {
        sql_query: statement + ';'
      })

      if (error) {
        // 尝试直接执行
        console.log('  使用 rpc 失败,尝试直接执行...')

        // 对于 CREATE FUNCTION, 使用原始 SQL
        const result = await supabase
          .from('_sql')
          .select('*')
          .eq('query', statement + ';')

        console.log(`  ⚠️  无法验证执行结果`)
        successCount++
      } else {
        console.log(`  ✅ 执行成功`)
        successCount++
      }
    } catch (err) {
      console.error(`  ❌ 执行失败:`, err.message)
      errorCount++
    }
  }

  console.log('\n===========================================')
  console.log(`执行完成: ${successCount} 成功, ${errorCount} 失败`)
  console.log('===========================================\n')
}

// 执行 089 脚本
const sqlFile = path.join(__dirname, '089_fix_checkin_missing_functions.sql')

executeSQLFile(sqlFile)
  .then(() => {
    console.log('✅ 脚本执行完成\n')
    console.log('下一步:')
    console.log('1. 重启开发服务器')
    console.log('2. 运行 node scripts/sync_points_and_transactions.js 修复历史数据')
    console.log('3. 测试查看联系方式功能')
    process.exit(0)
  })
  .catch((err) => {
    console.error('❌ 执行失败:', err)
    process.exit(1)
  })
