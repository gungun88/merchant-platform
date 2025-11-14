// 执行SQL脚本修复注册送积分功能
const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('缺少环境变量')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function executeSQLFile(filename) {
  console.log(`\n执行 SQL 文件: ${filename}`)

  const sqlPath = path.join(__dirname, filename)
  const sql = fs.readFileSync(sqlPath, 'utf8')

  // 分割SQL语句（按分号分割，但要小心函数定义中的分号）
  const statements = sql
    .split('$$')
    .map((part, index) => {
      if (index % 2 === 0) {
        // 在函数定义之外，可以按分号分割
        return part.split(';').filter(s => s.trim())
      } else {
        // 在函数定义内部，保持完整
        return [`$$${part}$$`]
      }
    })
    .flat()
    .map(s => s.trim())
    .filter(s => s && !s.startsWith('--'))

  console.log(`共 ${statements.length} 条SQL语句`)

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i]
    if (!stmt || stmt.startsWith('COMMENT')) continue

    console.log(`\n执行语句 ${i + 1}/${statements.length}:`)
    console.log(stmt.substring(0, 100) + '...')

    try {
      const { error } = await supabase.rpc('exec_sql', { sql_query: stmt })
        .catch(() => {
          // 如果 exec_sql 不存在，直接执行
          return supabase.from('_').select(stmt)
        })

      if (error) {
        console.error('执行失败:', error.message)
        // 继续执行其他语句
      } else {
        console.log('✓ 执行成功')
      }
    } catch (err) {
      console.error('执行错误:', err.message)
    }
  }
}

async function main() {
  console.log('=== 修复注册送积分功能 ===')

  // 直接通过 Supabase SQL Editor 执行
  console.log('\n请按照以下步骤操作：')
  console.log('1. 登录 Supabase Dashboard')
  console.log('2. 进入 SQL Editor')
  console.log('3. 复制 scripts/033_fix_registration_points.sql 的内容')
  console.log('4. 粘贴并执行')
  console.log('\n或者使用 Supabase CLI:')
  console.log('  npx supabase db push --db-url <your-database-url>')

  const sql = fs.readFileSync(path.join(__dirname, '033_fix_registration_points.sql'), 'utf8')
  console.log('\n--- SQL 内容 ---')
  console.log(sql)
  console.log('--- SQL 结束 ---\n')
}

main().catch(console.error)
