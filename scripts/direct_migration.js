/**
 * 直接执行 SQL 迁移
 */

const fs = require('fs')
const path = require('path')
const { Client } = require('pg')

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

async function runMigration() {
  // 从 Supabase URL 提取数据库连接信息
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabasePassword = process.env.SUPABASE_DB_PASSWORD

  if (!supabaseUrl || !supabasePassword) {
    console.error('❌ 缺少必要的环境变量')
    console.log('\n请在 Supabase Dashboard 的 SQL Editor 中手动执行以下 SQL:\n')
    console.log('='.repeat(60))
    const sqlPath = path.join(__dirname, '093_add_monthly_invitation_reset.sql')
    const sql = fs.readFileSync(sqlPath, 'utf-8')
    console.log(sql)
    console.log('='.repeat(60))
    return
  }

  // 构建数据库连接字符串
  const projectRef = supabaseUrl.match(/https:\/\/([^.]+)/)?.[1]
  const connectionString = `postgresql://postgres:${supabasePassword}@db.${projectRef}.supabase.co:5432/postgres`

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  })

  try {
    await client.connect()
    console.log('✅ 已连接到数据库\n')

    // 执行 SQL 迁移
    const sqlPath = path.join(__dirname, '093_add_monthly_invitation_reset.sql')
    const sql = fs.readFileSync(sqlPath, 'utf-8')

    console.log('📄 执行 SQL 迁移...\n')
    await client.query(sql)

    console.log('✅ 迁移执行成功！')
    console.log('===========================================')
    console.log('✅ 邀请次数按月重置功能已添加')
    console.log('   - profiles.invitation_reset_month 字段已创建')
    console.log('   - system_settings.invitation_monthly_reset 字段已创建')
    console.log('   - 默认启用按月重置功能')
    console.log('===========================================')

  } catch (error) {
    console.error('❌ 迁移执行失败:', error.message)
    console.log('\n请在 Supabase Dashboard 的 SQL Editor 中手动执行以下 SQL:\n')
    console.log('='.repeat(60))
    const sqlPath = path.join(__dirname, '093_add_monthly_invitation_reset.sql')
    const sql = fs.readFileSync(sqlPath, 'utf-8')
    console.log(sql)
    console.log('='.repeat(60))
  } finally {
    await client.end()
  }
}

runMigration()
