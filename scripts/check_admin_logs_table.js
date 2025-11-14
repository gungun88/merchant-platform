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

async function checkTable() {
  console.log('检查 admin_logs 表...\n')

  try {
    // 尝试查询表
    const { data, error } = await supabase
      .from('admin_logs')
      .select('count')
      .limit(1)

    if (error) {
      if (error.message.includes('relation') && error.message.includes('does not exist')) {
        console.log('❌ admin_logs 表不存在')
        console.log('\n需要执行 SQL 迁移:')
        console.log('请在 Supabase SQL Editor 中执行 scripts/049_create_admin_logs_table.sql\n')
        return false
      } else {
        console.error('查询出错:', error.message)
        return false
      }
    }

    console.log('✓ admin_logs 表存在')

    // 检查视图
    const { data: viewData, error: viewError } = await supabase
      .from('admin_logs_with_details')
      .select('count')
      .limit(1)

    if (viewError) {
      if (viewError.message.includes('relation') && viewError.message.includes('does not exist')) {
        console.log('❌ admin_logs_with_details 视图不存在')
        console.log('\n需要执行 SQL 迁移:')
        console.log('请在 Supabase SQL Editor 中执行 scripts/049_create_admin_logs_table.sql\n')
        return false
      } else {
        console.error('查询视图出错:', viewError.message)
        return false
      }
    }

    console.log('✓ admin_logs_with_details 视图存在')

    // 查询日志数量
    const { count, error: countError } = await supabase
      .from('admin_logs')
      .select('*', { count: 'exact', head: true })

    if (!countError) {
      console.log(`\n当前日志记录数: ${count} 条`)
    }

    console.log('\n✅ 操作日志功能数据库准备完成!')
    return true

  } catch (error) {
    console.error('检查失败:', error.message)
    return false
  }
}

checkTable()
