// 临时脚本：查询所有商家信息
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://vqdkrubllqjgxohxdpei.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZxZGtydWJsbHFqZ3hvaHhkcGVpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTExNjUzNCwiZXhwIjoyMDc2NjkyNTM0fQ.08SezL9H1QGZLGS-UrcVMXAOMXggXI1-nTRbAhgHBsc'

const supabase = createClient(supabaseUrl, supabaseKey)

async function queryMerchants() {
  console.log('正在查询商家信息...\n')

  const { data, error } = await supabase
    .from('merchants')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('查询失败:', error)
    return
  }

  if (!data || data.length === 0) {
    console.log('没有找到任何商家记录')
    return
  }

  console.log(`找到 ${data.length} 个商家:\n`)

  data.forEach((merchant, index) => {
    console.log(`${index + 1}. 商家名称: ${merchant.name}`)
    console.log(`   商家ID: ${merchant.id}`)
    console.log(`   用户ID: ${merchant.user_id}`)
    console.log(`   押金商家: ${merchant.is_deposit_merchant ? '是' : '否'}`)
    console.log(`   押金状态: ${merchant.deposit_status || '无'}`)
    console.log(`   押金金额: ${merchant.deposit_amount || 0} USDT`)
    console.log(`   创建时间: ${merchant.created_at}`)
    console.log('---')
  })

  console.log('\n=== 设置押金商家的SQL命令 ===\n')

  // 为每个非押金商家生成SQL
  data.forEach((merchant, index) => {
    if (!merchant.is_deposit_merchant) {
      console.log(`-- 设置 "${merchant.name}" 为押金商家`)
      console.log(`UPDATE merchants SET`)
      console.log(`  is_deposit_merchant = true,`)
      console.log(`  deposit_status = 'paid',`)
      console.log(`  deposit_amount = 500,`)
      console.log(`  deposit_paid_at = NOW()`)
      console.log(`WHERE id = '${merchant.id}';\n`)
    }
  })
}

queryMerchants()
