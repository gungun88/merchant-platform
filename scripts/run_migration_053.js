/**
 * 执行数据库迁移: 添加邮箱验证配置
 */

require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

async function runMigration() {
  console.log('🚀 开始执行邮箱验证配置迁移...\n')

  // 创建 Supabase 客户端
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  )

  try {
    // 读取 SQL 文件
    const sqlPath = path.join(__dirname, '053_add_email_validation_settings.sql')
    const sql = fs.readFileSync(sqlPath, 'utf8')

    // 分割 SQL 语句（按分号和换行符）
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--') && !s.startsWith('COMMENT') && !s.startsWith('DO $$'))

    console.log(`📄 找到 ${statements.length} 条 SQL 语句\n`)

    // 执行每条语句
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i]
      console.log(`⏳ 执行语句 ${i + 1}/${statements.length}...`)

      const { data, error } = await supabase.rpc('exec_sql', {
        sql_query: statement + ';'
      })

      if (error) {
        // 如果是 "column already exists" 错误，可以忽略
        if (error.message.includes('already exists')) {
          console.log(`   ⚠️  字段已存在，跳过`)
        } else {
          throw error
        }
      } else {
        console.log(`   ✅ 执行成功`)
      }
    }

    // 验证字段是否已添加
    console.log('\n🔍 验证配置...')
    const { data: settings, error: selectError } = await supabase
      .from('system_settings')
      .select('email_validation_enabled, email_validation_mode, email_allowed_domains, email_blocked_domains')
      .single()

    if (selectError) {
      throw selectError
    }

    console.log('\n✅ 迁移完成！当前配置：')
    console.log('   - 邮箱验证启用:', settings.email_validation_enabled)
    console.log('   - 验证模式:', settings.email_validation_mode)
    console.log('   - 白名单域名数量:', settings.email_allowed_domains?.length || 0)
    console.log('   - 黑名单域名数量:', settings.email_blocked_domains?.length || 0)
    console.log('\n📝 管理员可以在后台设置页面修改这些配置')

  } catch (error) {
    console.error('\n❌ 迁移失败:', error.message)
    console.error('详细信息:', error)
    process.exit(1)
  }
}

runMigration()
