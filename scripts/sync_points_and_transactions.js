/**
 * 同步 profiles.points 和 point_transactions 的差异
 * 为每个用户补充缺失的初始积分交易记录
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

async function syncPointsAndTransactions() {
  console.log('🔄 开始同步 profiles.points 和交易记录...\n')

  try {
    // 1. 获取所有用户
    const { data: users, error: usersError } = await supabase
      .from('profiles')
      .select('id, points, username, created_at')
      .order('created_at')

    if (usersError) throw usersError

    console.log(`📊 共找到 ${users.length} 个用户\n`)

    let syncedCount = 0
    let skippedCount = 0
    const syncResults = []

    // 2. 遍历每个用户
    for (const user of users) {
      // 获取该用户的所有交易记录
      const { data: transactions, error: txError } = await supabase
        .from('point_transactions')
        .select('amount, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })

      if (txError) {
        console.error(`❌ 获取用户 ${user.id} 的交易记录失败:`, txError.message)
        continue
      }

      // 计算交易记录的余额
      const calculatedBalance = transactions.reduce((sum, tx) => sum + tx.amount, 0)
      const diff = user.points - calculatedBalance

      if (diff !== 0) {
        // 需要补充交易记录
        const firstTransaction = transactions[0]
        const adjustmentTime = firstTransaction
          ? new Date(new Date(firstTransaction.created_at).getTime() - 1000) // 比第一笔交易早1秒
          : new Date(user.created_at) // 或使用注册时间

        console.log(`用户 ${user.username || user.id.substring(0, 8)}:`)
        console.log(`  当前积分: ${user.points}`)
        console.log(`  交易余额: ${calculatedBalance}`)
        console.log(`  差异: ${diff}`)
        console.log(`  补充交易: ${diff > 0 ? '+' : ''}${diff}`)

        // 插入补充交易记录
        const { error: insertError } = await supabase
          .from('point_transactions')
          .insert({
            user_id: user.id,
            amount: diff,
            balance_after: diff,
            type: 'system_adjustment',
            description: `系统调整：补充历史积分记录 ${diff > 0 ? '+' : ''}${diff}积分`,
            created_at: adjustmentTime.toISOString()
          })

        if (insertError) {
          console.error(`  ❌ 插入失败:`, insertError.message)
        } else {
          console.log(`  ✅ 已补充\n`)
          syncedCount++
          syncResults.push({
            userId: user.id,
            username: user.username,
            diff
          })
        }
      } else {
        skippedCount++
      }
    }

    console.log('===========================================')
    console.log(`✅ 同步完成!`)
    console.log(`   需要补充的用户: ${syncedCount}`)
    console.log(`   无需补充的用户: ${skippedCount}`)
    console.log('===========================================\n')

    if (syncedCount > 0) {
      console.log('补充记录汇总:')
      syncResults.forEach(r => {
        console.log(`  ${r.username || r.userId.substring(0, 8)}: ${r.diff > 0 ? '+' : ''}${r.diff}`)
      })
      console.log('')
    }

    // 3. 重新计算所有 balance_after
    console.log('🔄 重新计算所有 balance_after...\n')

    for (const user of users) {
      // 获取该用户的所有交易，按时间排序
      const { data: transactions } = await supabase
        .from('point_transactions')
        .select('id, amount')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })
        .order('id', { ascending: true })

      let runningBalance = 0
      for (const tx of transactions) {
        runningBalance += tx.amount

        await supabase
          .from('point_transactions')
          .update({ balance_after: runningBalance })
          .eq('id', tx.id)
      }
    }

    console.log('✅ balance_after 重新计算完成\n')

    // 4. 验证
    await verifyData()

  } catch (err) {
    console.error('❌ 同步失败:', err.message)
    throw err
  }
}

async function verifyData() {
  console.log('🔍 验证数据正确性...\n')

  try {
    const { data: users } = await supabase
      .from('profiles')
      .select('id, points')

    let mismatchCount = 0

    for (const user of users) {
      const { data: lastTx } = await supabase
        .from('point_transactions')
        .select('balance_after')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(1)
        .single()

      if (lastTx && lastTx.balance_after !== user.points) {
        mismatchCount++
      }
    }

    if (mismatchCount > 0) {
      console.log(`⚠️  仍有 ${mismatchCount} 个用户的余额数据不一致\n`)
    } else {
      console.log(`✅ 所有用户的余额数据一致! (共 ${users.length} 个用户)\n`)
    }

  } catch (err) {
    console.error('❌ 验证失败:', err.message)
  }
}

syncPointsAndTransactions()
  .then(() => {
    console.log('✅ 所有操作完成\n')
    console.log('下一步操作:')
    console.log('1. 刷新前端页面查看积分记录')
    console.log('2. 确认余额显示正确')
    console.log('3. 测试新的积分操作（签到、邀请等）\n')
    process.exit(0)
  })
  .catch((err) => {
    console.error('❌ 执行失败:', err)
    process.exit(1)
  })
