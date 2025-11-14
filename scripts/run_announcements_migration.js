require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('错误：缺少环境变量')
  console.error('需要: NEXT_PUBLIC_SUPABASE_URL 和 SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function runMigration() {
  try {
    console.log('开始执行公告表迁移...\n')

    // 读取SQL文件
    const sqlPath = path.join(__dirname, '044_create_announcements_table.sql')
    const sql = fs.readFileSync(sqlPath, 'utf8')

    // 执行SQL
    const { data, error } = await supabase.rpc('exec_sql', { sql_string: sql })

    if (error) {
      // 如果RPC函数不存在，尝试直接执行
      console.log('RPC函数不存在，尝试分段执行...\n')

      // 分段执行SQL语句
      const statements = sql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'))

      for (const statement of statements) {
        if (statement.trim()) {
          console.log(`执行: ${statement.substring(0, 50)}...`)
          const { error: execError } = await supabase.rpc('exec_sql', {
            sql_string: statement + ';'
          })

          if (execError) {
            console.error('执行错误:', execError.message)
            // 继续执行，某些语句可能已经存在
          } else {
            console.log('✓ 成功')
          }
        }
      }
    } else {
      console.log('✓ SQL执行成功')
    }

    // 验证表是否创建成功
    console.log('\n验证表结构...')
    const { data: tableData, error: tableError } = await supabase
      .from('announcements')
      .select('*')
      .limit(0)

    if (tableError) {
      console.error('❌ 表验证失败:', tableError.message)
      console.log('\n请手动在 Supabase SQL Editor 中执行 044_create_announcements_table.sql')
    } else {
      console.log('✓ 公告表创建成功！')
    }

    console.log('\n迁移完成！')

  } catch (error) {
    console.error('迁移失败:', error.message)
    console.log('\n请手动在 Supabase SQL Editor 中执行 scripts/044_create_announcements_table.sql')
    process.exit(1)
  }
}

runMigration()
