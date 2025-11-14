// 验证兑换记录
// 用法: node scripts/verify_exchange_records.js

const fs = require('fs')
const path = require('path')
const { createClient } = require('@supabase/supabase-js')

function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env.local')
  const envContent = fs.readFileSync(envPath, 'utf8')
  const env = {}

  envContent.split('\n').forEach(line => {
    const trimmedLine = line.trim()
    if (trimmedLine && !trimmedLine.startsWith('#')) {
      const [key, ...valueParts] = trimmedLine.split('=')
      if (key && valueParts.length > 0) {
        env[key.trim()] = valueParts.join('=').trim()
      }
    }
  })

  return env
}

const env = loadEnv()
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function verifyRecords() {
  console.log('🔍 验证兑换记录...\n')

  // 1. 查看兑换记录
  const { data: exchanges, error: exchangeError } = await supabase
    .from('coin_exchange_records')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10)

  if (exchangeError) {
    console.error('❌ 查询兑换记录失败:', exchangeError.message)
  } else {
    console.log(`✅ 找到 ${exchanges.length} 条兑换记录:\n`)
    exchanges.forEach((record, index) => {
      console.log(`${index + 1}. 交易ID: ${record.forum_transaction_id}`)
      console.log(`   用户邮箱: ${record.user_email}`)
      console.log(`   硬币: ${record.coin_amount} → 积分: ${record.points_amount}`)
      console.log(`   状态: ${record.status}`)
      console.log(`   时间: ${new Date(record.created_at).toLocaleString('zh-CN')}`)
      console.log('')
    })
  }

  // 2. 查看用户积分变化
  const { data: user, error: userError } = await supabase
    .from('profiles')
    .select('email, username, points')
    .eq('email', '9knsf@2200freefonts.com')
    .single()

  if (userError) {
    console.error('❌ 查询用户失败:', userError.message)
  } else {
    console.log('👤 用户信息:')
    console.log(`   邮箱: ${user.email}`)
    console.log(`   用户名: ${user.username}`)
    console.log(`   当前积分: ${user.points}`)
    console.log('')
  }

  // 3. 查看积分流水
  const { data: transactions, error: transError } = await supabase
    .from('point_transactions')
    .select('*')
    .eq('type', 'coin_exchange')
    .order('created_at', { ascending: false })
    .limit(10)

  if (transError) {
    console.error('❌ 查询积分流水失败:', transError.message)
  } else {
    console.log(`💰 积分流水记录 (${transactions.length} 条):\n`)
    transactions.forEach((trans, index) => {
      console.log(`${index + 1}. ${trans.description}`)
      console.log(`   金额: +${trans.amount}`)
      console.log(`   余额: ${trans.balance_after}`)
      console.log(`   时间: ${new Date(trans.created_at).toLocaleString('zh-CN')}`)
      console.log('')
    })
  }

  console.log('✅ 验证完成！')
}

verifyRecords()
