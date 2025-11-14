const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

// 从 .env.local 读取环境变量
const envPath = path.join(__dirname, '..', '.env.local')
const envContent = fs.readFileSync(envPath, 'utf8')
const envVars = {}
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/)
  if (match) {
    envVars[match[1].trim()] = match[2].trim()
  }
})

const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = envVars.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('错误: 缺少必要的环境变量')
  console.error('请确保 .env.local 文件中包含:')
  console.error('- NEXT_PUBLIC_SUPABASE_URL')
  console.error('- SUPABASE_SERVICE_ROLE_KEY')
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
    console.log('开始执行登录安全字段迁移...')

    const sqlPath = path.join(__dirname, '050_add_login_security_fields.sql')
    const sql = fs.readFileSync(sqlPath, 'utf8')

    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql })

    if (error) {
      // 如果 exec_sql 函数不存在，直接执行 SQL
      console.log('尝试直接执行 SQL...')
      const { error: directError } = await supabase.from('profiles').select('login_failed_attempts').limit(1)

      if (directError && directError.message.includes('column') && directError.message.includes('does not exist')) {
        console.error('需要手动执行 SQL 迁移')
        console.log('\n请在 Supabase SQL Editor 中执行以下 SQL:\n')
        console.log(sql)
        process.exit(1)
      } else {
        console.log('✓ 字段可能已存在，无需迁移')
      }
    } else {
      console.log('✓ 迁移执行成功')
    }

    // 验证字段是否已添加
    console.log('\n验证字段...')
    const { data: testData, error: testError } = await supabase
      .from('profiles')
      .select('login_failed_attempts, account_locked_until, last_failed_login_at')
      .limit(1)

    if (testError) {
      console.error('✗ 验证失败:', testError.message)
      console.log('\n请手动在 Supabase SQL Editor 中执行:')
      console.log(sql)
    } else {
      console.log('✓ 字段验证成功')
      console.log('✓ 登录安全功能数据库准备完成')
    }

  } catch (error) {
    console.error('迁移失败:', error.message)
    process.exit(1)
  }
}

runMigration()
