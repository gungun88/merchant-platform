// 设置押金商家的脚本
const { createClient } = require('@supabase/supabase-js')
const readline = require('readline')

const supabaseUrl = 'https://vqdkrubllqjgxohxdpei.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZxZGtydWJsbHFqZ3hvaHhkcGVpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTExNjUzNCwiZXhwIjoyMDc2NjkyNTM0fQ.08SezL9H1QGZLGS-UrcVMXAOMXggXI1-nTRbAhgHBsc'

const supabase = createClient(supabaseUrl, supabaseKey)

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      resolve(answer)
    })
  })
}

async function setDepositMerchant() {
  console.log('=== 设置押金商家脚本 ===\n')

  // 查询所有非押金商家
  const { data: merchants, error } = await supabase
    .from('merchants')
    .select('id, name, user_id, is_deposit_merchant, deposit_status')
    .eq('is_deposit_merchant', false)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('查询商家失败:', error)
    rl.close()
    return
  }

  if (!merchants || merchants.length === 0) {
    console.log('没有找到需要设置的商家（所有商家都已是押金商家）')
    rl.close()
    return
  }

  console.log('当前非押金商家列表：\n')
  merchants.forEach((merchant, index) => {
    console.log(`${index + 1}. ${merchant.name} (ID: ${merchant.id})`)
  })

  console.log('\n请选择操作：')
  console.log('1. 设置单个商家为押金商家')
  console.log('2. 设置所有商家为押金商家')
  console.log('3. 退出')

  const choice = await question('\n请输入选项 (1-3): ')

  if (choice === '3') {
    console.log('已退出')
    rl.close()
    return
  }

  if (choice === '1') {
    // 设置单个商家
    const index = await question(`\n请输入商家编号 (1-${merchants.length}): `)
    const merchantIndex = parseInt(index) - 1

    if (merchantIndex < 0 || merchantIndex >= merchants.length) {
      console.log('无效的编号')
      rl.close()
      return
    }

    const merchant = merchants[merchantIndex]
    const depositAmount = await question('请输入押金金额（默认500 USDT）: ') || '500'

    console.log(`\n正在设置 "${merchant.name}" 为押金商家...`)

    const { error: updateError } = await supabase
      .from('merchants')
      .update({
        is_deposit_merchant: true,
        deposit_status: 'paid',
        deposit_amount: parseFloat(depositAmount),
        deposit_paid_at: new Date().toISOString()
      })
      .eq('id', merchant.id)

    if (updateError) {
      console.error('设置失败:', updateError)
    } else {
      console.log(`✓ 成功将 "${merchant.name}" 设置为押金商家！`)
      console.log(`  - 押金金额: ${depositAmount} USDT`)
      console.log(`  - 押金状态: 已支付`)
      console.log(`  - 商家ID: ${merchant.id}`)
    }

  } else if (choice === '2') {
    // 批量设置所有商家
    const depositAmount = await question('请输入押金金额（默认500 USDT）: ') || '500'
    const confirm = await question(`\n确认将 ${merchants.length} 个商家全部设置为押金商家？(y/n): `)

    if (confirm.toLowerCase() !== 'y') {
      console.log('已取消')
      rl.close()
      return
    }

    console.log('\n开始批量设置...\n')

    let successCount = 0
    let failCount = 0

    for (const merchant of merchants) {
      const { error: updateError } = await supabase
        .from('merchants')
        .update({
          is_deposit_merchant: true,
          deposit_status: 'paid',
          deposit_amount: parseFloat(depositAmount),
          deposit_paid_at: new Date().toISOString()
        })
        .eq('id', merchant.id)

      if (updateError) {
        console.log(`✗ 设置失败: ${merchant.name}`)
        console.error('  错误:', updateError.message)
        failCount++
      } else {
        console.log(`✓ 设置成功: ${merchant.name}`)
        successCount++
      }
    }

    console.log(`\n批量设置完成！`)
    console.log(`成功: ${successCount} 个`)
    console.log(`失败: ${failCount} 个`)

  } else {
    console.log('无效的选项')
  }

  rl.close()
}

setDepositMerchant()
