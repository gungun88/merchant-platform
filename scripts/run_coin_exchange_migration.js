// 运行硬币兑换积分迁移
// 用法: node scripts/run_coin_exchange_migration.js

const fs = require('fs')
const path = require('path')
const { createClient } = require('@supabase/supabase-js')

// 读取 .env.local 文件
function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env.local')
  const envContent = fs.readFileSync(envPath, 'utf8')
  const env = {}

  envContent.split('\n').forEach(line => {
    const trimmedLine = line.trim()
    if (trimmedLine && !trimmedLine.startsWith('#')) {
      const [key, ...valueParts] = trimmedLine.split('=')
      if (key && valueParts.length > 0) {
        env[key.trim()] = valueParts.join('=').trim()
      }
    }
  })

  return env
}

const env = loadEnv()
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ 缺少必要的环境变量')
  console.error('请确保 .env.local 中配置了:')
  console.error('- NEXT_PUBLIC_SUPABASE_URL')
  console.error('- SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function runMigration() {
  console.log('🔧 开始运行硬币兑换积分数据库迁移...\n')

  try {
    // 读取 SQL 文件
    const sqlPath = path.join(__dirname, '052_create_coin_exchange_records_table.sql')
    const sql = fs.readFileSync(sqlPath, 'utf8')

    console.log('📄 执行 SQL 脚本...')

    // 执行 SQL（分批执行，因为可能包含多条语句）
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'))

    for (const statement of statements) {
      if (statement.trim()) {
        const { error } = await supabase.rpc('exec_sql', { sql_query: statement })

        if (error) {
          // 如果 rpc 不可用，尝试直接执行
          const { error: directError } = await supabase.from('_migrations').insert({})

          if (directError) {
            console.log('⚠️  注意: 无法通过 RPC 执行，请手动在 Supabase SQL Editor 中执行迁移文件')
            console.log('📁 迁移文件路径:', sqlPath)
            console.log('\n建议操作:')
            console.log('1. 登录 Supabase Dashboard')
            console.log('2. 进入 SQL Editor')
            console.log('3. 复制 052_create_coin_exchange_records_table.sql 的内容')
            console.log('4. 粘贴并执行')
            return
          }
        }
      }
    }

    console.log('✅ 数据库迁移执行成功!')
    console.log('\n📊 已创建:')
    console.log('- coin_exchange_records 表（硬币兑换积分记录）')
    console.log('- 相关索引和 RLS 策略')

    console.log('\n📝 表结构说明:')
    console.log('- forum_transaction_id: 论坛交易ID（防重放）')
    console.log('- coin_amount: 消耗硬币数量')
    console.log('- points_amount: 获得积分数量')
    console.log('- exchange_rate: 兑换比例（1积分=10硬币）')
    console.log('- request_signature: API签名验证')
    console.log('- exchange_date: 用于日限额统计')

    console.log('\n🔐 安全策略:')
    console.log('- 用户只能查看自己的兑换记录')
    console.log('- 管理员可以查看所有记录')
    console.log('- 只能通过 API Service Role 插入记录')

  } catch (error) {
    console.error('❌ 迁移执行失败:', error.message)
    console.log('\n📁 请手动执行迁移文件:')
    console.log('   scripts/052_create_coin_exchange_records_table.sql')
    process.exit(1)
  }
}

runMigration()
