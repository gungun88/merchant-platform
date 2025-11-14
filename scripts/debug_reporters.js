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

async function debugReporters() {
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

  console.log('🔍 调试举报者信息...\n')

  try {
    // 1. 获取所有举报记录
    const { data: reports, error: reportsError } = await supabase
      .from('reports')
      .select('id, reporter_id, merchant_id, report_type, created_at')
      .order('created_at', { ascending: false })

    if (reportsError) {
      console.error('❌ 获取举报记录失败:', reportsError)
      return
    }

    console.log(`✅ 找到 ${reports.length} 条举报记录\n`)

    // 2. 获取唯一的举报者ID
    const reporterIds = [...new Set(reports.map(r => r.reporter_id))]
    console.log(`📋 举报者ID列表 (${reporterIds.length}个):`)
    reporterIds.forEach((id, index) => {
      console.log(`  ${index + 1}. ${id}`)
    })
    console.log('')

    // 3. 查询 profiles 表中的举报者信息
    const { data: reporters, error: reportersError } = await supabase
      .from('profiles')
      .select('id, username, avatar_url, report_count')
      .in('id', reporterIds)

    if (reportersError) {
      console.error('❌ 获取举报者信息失败:', reportersError)
      return
    }

    console.log(`✅ 从 profiles 表获取到 ${reporters?.length || 0} 个举报者信息\n`)

    // 4. 显示每个举报者的详细信息
    if (reporters && reporters.length > 0) {
      console.log('📊 举报者详细信息:')
      reporters.forEach((reporter, index) => {
        console.log(`\n  ${index + 1}. ID: ${reporter.id}`)
        console.log(`     用户名: ${reporter.username || '未设置'}`)
        console.log(`     头像: ${reporter.avatar_url ? '已设置' : '未设置'}`)
        console.log(`     举报次数: ${reporter.report_count !== undefined ? reporter.report_count : '字段不存在'}`)
      })
    } else {
      console.log('❌ 未找到任何举报者信息！')
    }

    console.log('\n')

    // 5. 检查是否有举报者ID在profiles表中不存在
    const foundIds = new Set(reporters?.map(r => r.id) || [])
    const missingIds = reporterIds.filter(id => !foundIds.has(id))

    if (missingIds.length > 0) {
      console.log('⚠️  以下举报者ID在profiles表中不存在:')
      missingIds.forEach((id, index) => {
        console.log(`  ${index + 1}. ${id}`)
      })
      console.log('\n这可能是因为:')
      console.log('  - 用户账号已被删除')
      console.log('  - profiles 表数据不完整')
      console.log('  - reporter_id 字段数据有误')
    } else {
      console.log('✅ 所有举报者都在 profiles 表中有对应记录')
    }

    // 6. 检查 profiles 表是否有 report_count 字段
    console.log('\n🔍 检查 profiles 表结构...')
    const { data: columns, error: columnsError } = await supabase
      .rpc('exec_sql', {
        sql_query: `
          SELECT column_name, data_type, is_nullable
          FROM information_schema.columns
          WHERE table_name = 'profiles'
            AND table_schema = 'public'
            AND column_name IN ('id', 'username', 'avatar_url', 'report_count')
          ORDER BY column_name
        `
      })

    if (!columnsError && columns) {
      console.log('✅ profiles 表字段:')
      console.table(columns)
    } else {
      console.log('⚠️  无法检查表结构 - 需要手动验证')
    }

  } catch (error) {
    console.error('❌ 调试过程出错:', error.message)
  }
}

debugReporters().catch(error => {
  console.error('❌ 脚本执行失败:', error.message)
  process.exit(1)
})
