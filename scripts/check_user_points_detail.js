/**
 * 检查特定用户的积分交易记录详情
 */

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

async function checkUserPoints(userId) {
  console.log('🔍 检查用户积分详情...\n')
  console.log(`用户ID: ${userId}\n`)

  try {
    // 1. 获取用户当前积分
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('points, username')
      .eq('id', userId)
      .single()

    if (profileError) throw profileError

    console.log('===========================================')
    console.log('用户信息:')
    console.log('===========================================')
    console.log(`用户名: ${profile.username || '未设置'}`)
    console.log(`当前积分 (profiles.points): ${profile.points}`)
    console.log('')

    // 2. 获取所有交易记录
    const { data: transactions, error: txError } = await supabase
      .from('point_transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })

    if (txError) throw txError

    console.log('===========================================')
    console.log('所有交易记录:')
    console.log('===========================================')

    let calculatedBalance = 0
    transactions.forEach((tx, index) => {
      calculatedBalance += tx.amount
      console.log(`${index + 1}. ${tx.created_at}`)
      console.log(`   类型: ${tx.type}`)
      console.log(`   描述: ${tx.description}`)
      console.log(`   变动: ${tx.amount > 0 ? '+' : ''}${tx.amount}`)
      console.log(`   记录的余额: ${tx.balance_after}`)
      console.log(`   计算的余额: ${calculatedBalance}`)
      if (tx.balance_after !== calculatedBalance) {
        console.log(`   ⚠️  不一致！差异: ${tx.balance_after - calculatedBalance}`)
      }
      console.log('')
    })

    // 3. 统计
    const totalEarned = transactions
      .filter(tx => tx.amount > 0)
      .reduce((sum, tx) => sum + tx.amount, 0)

    const totalSpent = Math.abs(
      transactions
        .filter(tx => tx.amount < 0)
        .reduce((sum, tx) => sum + tx.amount, 0)
    )

    console.log('===========================================')
    console.log('统计信息:')
    console.log('===========================================')
    console.log(`交易记录数: ${transactions.length}`)
    console.log(`累计获得: +${totalEarned}`)
    console.log(`累计消耗: -${totalSpent}`)
    console.log(`净积分: ${totalEarned - totalSpent}`)
    console.log('')
    console.log(`根据交易记录计算的余额: ${calculatedBalance}`)
    console.log(`profiles.points 当前值: ${profile.points}`)
    console.log(`差异: ${profile.points - calculatedBalance}`)
    console.log('')

    if (profile.points !== calculatedBalance) {
      console.log('⚠️  profiles.points 与交易记录不一致!')
      console.log('')
      console.log('可能原因:')
      console.log('1. 注册送积分没有记录交易')
      console.log('2. 某些积分操作直接修改了 profiles.points')
      console.log('3. 部分交易记录被删除了')
      console.log('')
      console.log('建议操作:')
      console.log(`1. 如果 ${profile.points} 是正确的，需要补充交易记录`)
      console.log(`2. 如果 ${calculatedBalance} 是正确的，需要更新 profiles.points`)
    } else {
      console.log('✅ profiles.points 与交易记录一致!')
    }

  } catch (err) {
    console.error('❌ 检查失败:', err.message)
    throw err
  }
}

// 从命令行参数获取用户ID，或使用默认值
const userId = process.argv[2] || '659b007e-8bff-4500-90fb-4456b9f9e528'

checkUserPoints(userId)
  .then(() => {
    console.log('\n✅ 检查完成')
    process.exit(0)
  })
  .catch((err) => {
    console.error('❌ 执行失败:', err)
    process.exit(1)
  })
