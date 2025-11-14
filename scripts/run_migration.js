// 运行 SQL 迁移脚本
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

async function runMigration() {
  const sqlFilePath = process.argv[2]

  if (!sqlFilePath) {
    console.error('❌ 请提供 SQL 文件路径作为参数')
    console.log('用法: node scripts/run_migration.js <sql-file-path>')
    process.exit(1)
  }

  const fullPath = path.isAbsolute(sqlFilePath)
    ? sqlFilePath
    : path.join(__dirname, '..', sqlFilePath)

  if (!fs.existsSync(fullPath)) {
    console.error(`❌ SQL 文件不存在: ${fullPath}`)
    process.exit(1)
  }

  console.log(`📄 正在读取 SQL 文件: ${sqlFilePath}`)
  const sqlContent = fs.readFileSync(fullPath, 'utf-8')

  console.log('🔄 正在执行迁移...\n')
  console.log('SQL 内容:')
  console.log('========================================')
  console.log(sqlContent)
  console.log('========================================\n')

  try {
    const { data, error } = await supabase.rpc('exec_sql', { sql: sqlContent })

    if (error) {
      // 尝试直接执行（某些 Supabase 版本可能不支持 exec_sql）
      console.log('⚠️  尝试使用备用方法执行 SQL...')

      // 分割多条 SQL 语句
      const statements = sqlContent
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'))

      for (const statement of statements) {
        console.log(`执行: ${statement.substring(0, 50)}...`)
        const result = await supabase.rpc('exec', { query: statement })
        if (result.error) {
          console.error('❌ SQL 执行失败:', result.error)
          throw result.error
        }
      }
    }

    console.log('✅ 迁移执行成功！')
  } catch (err) {
    console.error('❌ 迁移执行失败:', err.message)
    console.log('\n💡 提示: 请手动在 Supabase SQL 编辑器中执行此迁移脚本')
    console.log(`   路径: ${fullPath}`)
    process.exit(1)
  }
}

runMigration()
  .then(() => {
    console.log('\n✅ 完成')
    process.exit(0)
  })
  .catch((err) => {
    console.error('❌ 执行出错:', err)
    process.exit(1)
  })
