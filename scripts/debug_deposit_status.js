// 调试脚本：检查押金商家状态
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

async function debugDepositStatus() {
  console.log('=== 调试押金商家状态 ===\n')

  // 1. 查找最近的押金商家申请
  const { data: applications } = await supabase
    .from('deposit_merchant_applications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5)

  console.log('最近5条押金申请记录:')
  applications?.forEach((app, i) => {
    console.log(`${i + 1}. 商家ID: ${app.merchant_id}`)
    console.log(`   状态: ${app.application_status}`)
    console.log(`   申请时间: ${app.created_at}`)
    console.log(`   批准时间: ${app.approved_at || '未批准'}`)
    console.log('')
  })

  // 2. 查找对应的商家信息
  if (applications && applications.length > 0) {
    const merchantIds = applications.map(app => app.merchant_id)
    const { data: merchants } = await supabase
      .from('merchants')
      .select('id, name, user_id, is_deposit_merchant, deposit_status')
      .in('id', merchantIds)

    console.log('\n对应的商家信息:')
    merchants?.forEach((merchant, i) => {
      console.log(`${i + 1}. 商家: ${merchant.name} (ID: ${merchant.id})`)
      console.log(`   用户ID: ${merchant.user_id}`)
      console.log(`   是否押金商家: ${merchant.is_deposit_merchant}`)
      console.log(`   押金状态: ${merchant.deposit_status}`)
      console.log('')
    })
  }
}

debugDepositStatus()
  .then(() => {
    console.log('\n✅ 调试完成')
    process.exit(0)
  })
  .catch((err) => {
    console.error('❌ 执行出错:', err)
    process.exit(1)
  })

