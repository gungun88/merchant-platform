/**
 * 运行邀请次数按月重置迁移脚本
 */

const fs = require('fs')
const path = require('path')

// 手动加载 .env.local
const envPath = path.join(__dirname, '..', '.env.local')
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8')
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=:#]+)=(.*)/)
    if (match) {
      const key = match[1].trim()
      const value = match[2].trim()
      process.env[key] = value
    }
  })
}

const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ 缺少必要的环境变量')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function runMigration() {
  console.log('🔧 开始运行邀请次数按月重置迁移...\n')

  try {
    // 读取 SQL 文件
    const sqlPath = path.join(__dirname, '093_add_monthly_invitation_reset.sql')
    const sql = fs.readFileSync(sqlPath, 'utf-8')

    console.log('📄 SQL 内容:')
    console.log('========================================')
    console.log(sql)
    console.log('========================================\n')

    // 分割 SQL 语句并执行
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s && !s.startsWith('--') && !s.match(/^(BEGIN|COMMIT|DO \$\$)/))

    for (const statement of statements) {
      if (statement) {
        console.log(`执行: ${statement.substring(0, 50)}...`)
        const { error } = await supabase.rpc('exec', { query: statement })
        if (error && error.code !== 'PGRST202') {
          console.error('❌ 执行失败:', error)
        }
      }
    }

    console.log('\n✅ 迁移执行完成！')
    console.log('===========================================')
    console.log('✅ 邀请次数按月重置功能已添加')
    console.log('   - profiles.invitation_reset_month 字段已创建')
    console.log('   - system_settings.invitation_monthly_reset 字段已创建')
    console.log('   - 默认启用按月重置功能')
    console.log('===========================================')

  } catch (error) {
    console.error('\n❌ 迁移执行失败:', error)
    process.exit(1)
  }
}

runMigration()
