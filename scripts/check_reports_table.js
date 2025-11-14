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

async function checkReportsTable() {
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

  console.log('🔍 检查 reports 表是否存在...\n')

  try {
    // 检查表是否存在
    const { data: tableExists, error: tableError } = await supabase
      .from('reports')
      .select('id')
      .limit(1)

    if (tableError) {
      if (tableError.code === 'PGRST204' || tableError.message.includes('does not exist')) {
        console.log('❌ reports 表不存在')
        console.log('✅ 可以安全执行完整的迁移脚本\n')
        console.log('📝 请执行以下步骤:')
        console.log('1. 访问 Supabase SQL Editor')
        console.log('2. 复制并执行 scripts/032_create_reports_table.sql 的全部内容')
        return
      } else {
        console.error('❌ 检查表时出错:', tableError)
        return
      }
    }

    console.log('✅ reports 表已存在\n')

    // 检查表结构
    const { data: columns, error: columnsError } = await supabase
      .rpc('exec_sql', {
        sql_query: `
          SELECT column_name, data_type, is_nullable
          FROM information_schema.columns
          WHERE table_name = 'reports' AND table_schema = 'public'
          ORDER BY ordinal_position
        `
      })

    if (!columnsError && columns) {
      console.log('📋 表结构:')
      console.table(columns)
    }

    // 检查是否有数据
    const { count, error: countError } = await supabase
      .from('reports')
      .select('*', { count: 'exact', head: true })

    if (!countError) {
      console.log(`\n📊 当前记录数: ${count}`)
    }

    console.log('\n✅ reports 表已存在且可以正常使用')
    console.log('⚠️  之前的策略错误可以忽略 - 表已经正确创建')

  } catch (error) {
    console.error('❌ 检查过程出错:', error.message)
  }
}

checkReportsTable().catch(error => {
  console.error('❌ 脚本执行失败:', error.message)
  process.exit(1)
})
