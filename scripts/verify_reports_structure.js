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

async function verifyReportsStructure() {
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

  console.log('🔍 验证 reports 表结构...\n')

  try {
    // 获取一条记录来查看表结构
    const { data: reports, error } = await supabase
      .from('reports')
      .select('*')
      .limit(1)

    if (error) {
      console.error('❌ 查询失败:', error)
      return
    }

    if (reports && reports.length > 0) {
      console.log('✅ 成功读取记录\n')
      console.log('📋 表字段列表:')
      const fields = Object.keys(reports[0])
      fields.forEach(field => {
        console.log(`  - ${field}: ${typeof reports[0][field]}`)
      })

      // 检查关键字段
      console.log('\n🔑 关键字段检查:')
      const requiredFields = [
        'id',
        'reporter_id',
        'merchant_id',
        'report_type',
        'report_reason',
        'evidence_urls',
        'status',
        'created_at'
      ]

      requiredFields.forEach(field => {
        if (fields.includes(field)) {
          console.log(`  ✅ ${field}`)
        } else {
          console.log(`  ❌ ${field} (缺失)`)
        }
      })

      // 显示一条示例记录
      console.log('\n📄 示例记录:')
      console.log(JSON.stringify(reports[0], null, 2))

    } else {
      console.log('⚠️  表中暂无数据')
    }

    // 测试插入功能
    console.log('\n🧪 测试基本查询功能...')
    const { data: allReports, error: queryError } = await supabase
      .from('reports')
      .select('id, report_type, status, created_at')
      .order('created_at', { ascending: false })

    if (queryError) {
      console.error('❌ 查询失败:', queryError)
    } else {
      console.log(`✅ 成功查询到 ${allReports.length} 条记录`)
      console.log('\n最近的举报:')
      allReports.slice(0, 3).forEach(report => {
        console.log(`  - [${report.status}] ${report.report_type} (${new Date(report.created_at).toLocaleString('zh-CN')})`)
      })
    }

    console.log('\n✅ reports 表结构验证完成!')

  } catch (error) {
    console.error('❌ 验证过程出错:', error.message)
  }
}

verifyReportsStructure().catch(error => {
  console.error('❌ 脚本执行失败:', error.message)
  process.exit(1)
})
