// 快速设置押金商家脚本
// 用法: node scripts/set_deposit_merchant_quick.js <商家ID或编号> [押金金额]
// 例如: node scripts/set_deposit_merchant_quick.js 1 500

const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://vqdkrubllqjgxohxdpei.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZxZGtydWJsbHFqZ3hvaHhkcGVpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTExNjUzNCwiZXhwIjoyMDc2NjkyNTM0fQ.08SezL9H1QGZLGS-UrcVMXAOMXggXI1-nTRbAhgHBsc'

const supabase = createClient(supabaseUrl, supabaseKey)

const merchantsList = [
  { id: '0deb9f57-76d6-4de5-8eee-b4fee06c5f4e', name: '竞拍叔叔' },
  { id: '97496abd-37d8-4e1b-aca2-6fa9c1694cc9', name: '道哈达达瓦' },
  { id: 'f85b538d-ad47-43d3-81ed-af082d175b20', name: 'yawawa' },
  { id: '38edfc78-be7b-4177-87bd-5f8b2a29a87c', name: '西部牛仔' },
  { id: '4bdba62d-c1c5-4c88-a1ab-2978f442d306', name: '我i问我我' },
  { id: 'be471a4c-06c9-4001-a961-48488be07509', name: '使用邀请码注册' },
  { id: 'd1bdb978-5088-4467-bfa7-03f2659b7de7', name: '不爱我我的' },
  { id: '7c8123c8-65f8-47ba-bce6-30df4cb44011', name: '测试01' },
  { id: 'ffc96a86-4b90-4906-b798-0bb2984c215d', name: '虚拟卡服务商' },
  { id: '265aeecb-689c-47cb-a454-8065654b0adb', name: '谷歌一手批发商' },
  { id: '7c08c5fa-d52b-4e84-b89f-39646670c493', name: '测试商家编辑4' }
]

async function setDepositMerchant() {
  const args = process.argv.slice(2)

  if (args.length === 0 || args[0] === 'help' || args[0] === '--help') {
    console.log('=== 设置押金商家脚本 ===\n')
    console.log('用法:')
    console.log('  node scripts/set_deposit_merchant_quick.js <商家编号或ID> [押金金额]\n')
    console.log('示例:')
    console.log('  node scripts/set_deposit_merchant_quick.js 1 500')
    console.log('  node scripts/set_deposit_merchant_quick.js all 500\n')
    console.log('可用的商家列表:\n')
    merchantsList.forEach((m, i) => {
      console.log(`  ${i + 1}. ${m.name}`)
    })
    console.log('\n特殊命令:')
    console.log('  all - 设置所有商家为押金商家')
    return
  }

  const input = args[0]
  const depositAmount = parseFloat(args[1] || '500')

  if (input === 'all') {
    // 批量设置所有商家
    console.log(`\n开始批量设置所有商家为押金商家（押金金额: ${depositAmount} USDT）...\n`)

    let successCount = 0
    let failCount = 0

    for (const merchant of merchantsList) {
      const { error } = await supabase
        .from('merchants')
        .update({
          is_deposit_merchant: true,
          deposit_status: 'paid',
          deposit_amount: depositAmount,
          deposit_paid_at: new Date().toISOString()
        })
        .eq('id', merchant.id)

      if (error) {
        console.log(`✗ 设置失败: ${merchant.name}`)
        console.error(`  错误: ${error.message}`)
        failCount++
      } else {
        console.log(`✓ 设置成功: ${merchant.name}`)
        successCount++
      }
    }

    console.log(`\n批量设置完成！`)
    console.log(`✓ 成功: ${successCount} 个`)
    console.log(`✗ 失败: ${failCount} 个`)
    return
  }

  // 设置单个商家
  let merchantId
  let merchantName

  // 判断输入的是编号还是ID
  if (/^\d+$/.test(input)) {
    const index = parseInt(input) - 1
    if (index < 0 || index >= merchantsList.length) {
      console.error(`错误: 无效的商家编号 ${input}`)
      console.log(`请输入 1-${merchantsList.length} 之间的编号，或使用 'help' 查看帮助`)
      return
    }
    merchantId = merchantsList[index].id
    merchantName = merchantsList[index].name
  } else {
    // 假设输入的是ID
    merchantId = input
    const found = merchantsList.find(m => m.id === input)
    merchantName = found ? found.name : '未知商家'
  }

  console.log(`\n正在设置 "${merchantName}" 为押金商家...`)
  console.log(`  商家ID: ${merchantId}`)
  console.log(`  押金金额: ${depositAmount} USDT\n`)

  const { error } = await supabase
    .from('merchants')
    .update({
      is_deposit_merchant: true,
      deposit_status: 'paid',
      deposit_amount: depositAmount,
      deposit_paid_at: new Date().toISOString()
    })
    .eq('id', merchantId)

  if (error) {
    console.error('✗ 设置失败:', error.message)
  } else {
    console.log(`✓ 成功将 "${merchantName}" 设置为押金商家！`)
    console.log(`  - 押金金额: ${depositAmount} USDT`)
    console.log(`  - 押金状态: 已支付`)
    console.log(`  - 支付时间: ${new Date().toLocaleString('zh-CN')}`)
  }
}

setDepositMerchant()
