/**
 * 重新计算所有积分交易记录的 balance_after 字段
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

async function recalculateBalances() {
  console.log('🔄 开始重新计算所有积分交易记录的余额...\n')

  try {
    // 读取 SQL 脚本
    const sqlPath = path.join(__dirname, '090_recalculate_balance_after.sql')
    const sqlContent = fs.readFileSync(sqlPath, 'utf-8')

    console.log('📄 执行 SQL 脚本: 090_recalculate_balance_after.sql\n')

    // 执行 SQL 脚本
    const { data, error } = await supabase.rpc('exec_sql', {
      sql_query: sqlContent
    })

    if (error) {
      // 如果 exec_sql 函数不存在，使用分段执行
      console.log('⚠️  无法使用 exec_sql 函数，尝试手动重新计算...\n')
      await manualRecalculate()
      return
    }

    console.log('✅ SQL 脚本执行完成!\n')
    console.log('结果:', data)

  } catch (err) {
    console.error('❌ 执行出错，尝试手动重新计算...\n')
    await manualRecalculate()
  }
}

async function manualRecalculate() {
  console.log('🔄 手动重新计算所有用户的积分余额...\n')

  try {
    // 1. 获取所有用户
    const { data: users, error: usersError } = await supabase
      .from('point_transactions')
      .select('user_id')
      .order('user_id')

    if (usersError) throw usersError

    const uniqueUsers = [...new Set(users.map(u => u.user_id))]
    console.log(`📊 共找到 ${uniqueUsers.length} 个用户\n`)

    let totalUpdated = 0

    // 2. 遍历每个用户
    for (let i = 0; i < uniqueUsers.length; i++) {
      const userId = uniqueUsers[i]

      // 获取该用户的所有交易，按时间排序
      const { data: transactions, error: txError } = await supabase
        .from('point_transactions')
        .select('id, amount, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: true })
        .order('id', { ascending: true })

      if (txError) {
        console.error(`❌ 获取用户 ${userId} 的交易记录失败:`, txError.message)
        continue
      }

      // 3. 计算每笔交易的余额
      let runningBalance = 0
      for (const tx of transactions) {
        runningBalance += tx.amount

        // 更新该记录的 balance_after
        const { error: updateError } = await supabase
          .from('point_transactions')
          .update({ balance_after: runningBalance })
          .eq('id', tx.id)

        if (updateError) {
          console.error(`❌ 更新交易记录 ${tx.id} 失败:`, updateError.message)
        } else {
          totalUpdated++
        }
      }

      // 每处理10个用户输出一次进度
      if ((i + 1) % 10 === 0) {
        console.log(`进度: ${i + 1}/${uniqueUsers.length} 个用户已处理`)
      }
    }

    console.log('\n===========================================')
    console.log(`✅ 手动重新计算完成!`)
    console.log(`   处理用户数: ${uniqueUsers.length}`)
    console.log(`   更新记录数: ${totalUpdated}`)
    console.log('===========================================\n')

    // 4. 验证数据
    await verifyData()

  } catch (err) {
    console.error('❌ 手动重新计算失败:', err.message)
    throw err
  }
}

async function verifyData() {
  console.log('🔍 验证数据正确性...\n')

  try {
    // 获取所有用户的最后一笔交易
    const { data: users } = await supabase
      .from('profiles')
      .select('id, points')

    let mismatchCount = 0
    const mismatches = []

    for (const user of users) {
      // 获取该用户最后一笔交易
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
        mismatches.push({
          userId: user.id,
          transactionBalance: lastTx.balance_after,
          profilePoints: user.points,
          diff: user.points - lastTx.balance_after
        })
      }
    }

    if (mismatchCount > 0) {
      console.log(`⚠️  发现 ${mismatchCount} 个用户的余额数据不一致\n`)
      console.log('不一致的用户列表（前10个）:')
      console.log('-------------------------------------------')
      mismatches.slice(0, 10).forEach(m => {
        console.log(`用户ID: ${m.userId}`)
        console.log(`  交易余额: ${m.transactionBalance}`)
        console.log(`  实际积分: ${m.profilePoints}`)
        console.log(`  差异: ${m.diff}`)
        console.log('-------------------------------------------')
      })

      if (mismatchCount > 10) {
        console.log(`... 还有 ${mismatchCount - 10} 个用户未显示\n`)
      }

      console.log('💡 可能原因:')
      console.log('   1. profiles.points 字段被直接修改过')
      console.log('   2. 部分交易记录缺失')
      console.log('   3. 需要手动同步数据\n')
    } else {
      console.log(`✅ 所有用户的余额数据一致! (共 ${users.length} 个用户)\n`)
    }

  } catch (err) {
    console.error('❌ 验证数据失败:', err.message)
  }
}

recalculateBalances()
  .then(() => {
    console.log('✅ 所有操作完成')
    console.log('\n下一步操作:')
    console.log('1. 刷新前端页面查看积分记录')
    console.log('2. 确认余额显示正确')
    console.log('3. 测试新的积分操作（签到、邀请等）\n')
    process.exit(0)
  })
  .catch((err) => {
    console.error('❌ 执行失败:', err)
    process.exit(1)
  })
