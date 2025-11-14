// 临时脚本：查询所有押金申请记录
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
  envVars.SUPABASE_SERVICE_ROLE_KEY
)

async function checkApplications() {
  console.log('正在查询所有押金申请记录...\n')

  // 查询所有押金申请（不限制状态）
  const { data, error, count } = await supabase
    .from('deposit_merchant_applications')
    .select('*, merchants(name, user_id)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .limit(10)

  if (error) {
    console.error('查询失败:', error)
    return
  }

  console.log(`总共找到 ${count} 条押金申请记录\n`)

  if (data && data.length > 0) {
    console.log('最近的申请记录：')
    console.log('==========================================')
    data.forEach((app, index) => {
      console.log(`\n记录 ${index + 1}:`)
      console.log(`  - 申请ID: ${app.id}`)
      console.log(`  - 商家名称: ${app.merchants?.name || '未知'}`)
      console.log(`  - 押金金额: ${app.deposit_amount} USDT`)
      console.log(`  - 申请状态: ${app.application_status}`)
      console.log(`  - 申请时间: ${new Date(app.created_at).toLocaleString('zh-CN')}`)
      console.log(`  - 支付凭证: ${app.payment_proof_url || '无'}`)
    })
  } else {
    console.log('❌ 没有找到任何押金申请记录！')
    console.log('\n可能的原因：')
    console.log('1. 申请时出错，数据没有插入到数据库')
    console.log('2. 表名或字段名不匹配')
  }

  console.log('\n==========================================')
}

checkApplications()
  .then(() => {
    console.log('\n✅ 查询完成')
    process.exit(0)
  })
  .catch((err) => {
    console.error('❌ 执行出错:', err)
    process.exit(1)
  })
