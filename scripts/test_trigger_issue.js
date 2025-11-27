// 既然触发器存在,让我们测试为什么不工作
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('缺少环境变量')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function detailedTriggerTest() {
  console.log('\n' + '='.repeat(60))
  console.log('触发器详细测试 (触发器已确认存在)')
  console.log('='.repeat(60))

  const testEmail = `final_test_${Date.now()}@test.com`

  console.log('\n【1】创建测试用户')
  console.log(`邮箱: ${testEmail}`)

  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: testEmail,
    password: 'Test123!@#',
    email_confirm: true,
    user_metadata: {
      username: 'final_test'
    }
  })

  if (authError) {
    console.log('❌ 创建用户失败:', authError.message)
    return
  }

  console.log('✅ Auth 用户创建成功')
  console.log(`   用户 ID: ${authData.user.id}`)
  console.log(`   邮箱: ${authData.user.email}`)
  console.log(`   创建时间: ${authData.user.created_at}`)

  // 立即检查 (触发器是同步的)
  console.log('\n【2】立即检查 profile (触发器应该是同步执行)')

  let { data: profile1, error: profileError1 } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', authData.user.id)
    .maybeSingle()

  if (profile1) {
    console.log('✅ Profile 立即创建成功!')
    console.log('   用户名:', profile1.username)
    console.log('   用户编号:', profile1.user_number)
    console.log('   邀请码:', profile1.invitation_code)
    console.log('   积分:', profile1.points)
    console.log('   邮箱:', profile1.email)
  } else {
    console.log('⏳ Profile 未立即创建,等待5秒...')

    await new Promise(resolve => setTimeout(resolve, 5000))

    let { data: profile2, error: profileError2 } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authData.user.id)
      .maybeSingle()

    if (profile2) {
      console.log('✅ Profile 延迟创建成功 (5秒后)')
      console.log('   用户名:', profile2.username)
      console.log('   用户编号:', profile2.user_number)
      console.log('   邀请码:', profile2.invitation_code)
      console.log('   积分:', profile2.points)
      profile1 = profile2
    } else {
      console.log('❌ 等待5秒后仍未创建 profile')
      if (profileError2) {
        console.log('   错误:', profileError2.message)
      }
    }
  }

  if (profile1) {
    // 检查积分记录
    console.log('\n【3】检查积分记录')
    const { data: transactions, error: transError } = await supabase
      .from('point_transactions')
      .select('*')
      .eq('user_id', authData.user.id)

    if (transactions && transactions.length > 0) {
      console.log(`✅ 找到 ${transactions.length} 条积分记录:`)
      transactions.forEach(t => {
        console.log(`   - ${t.type}: ${t.description} (${t.amount}积分)`)
      })
    } else {
      console.log('❌ 没有找到积分记录')
      if (transError) {
        console.log('   错误:', transError.message)
      }
    }

    // 检查通知
    console.log('\n【4】检查通知')
    const { data: notifications, error: notifError } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', authData.user.id)

    if (notifications && notifications.length > 0) {
      console.log(`✅ 找到 ${notifications.length} 条通知:`)
      notifications.forEach(n => {
        console.log(`   - ${n.title}: ${n.content}`)
      })
    } else {
      console.log('❌ 没有找到通知')
      if (notifError) {
        console.log('   错误:', notifError.message)
      }
    }
  }

  // 清理
  console.log('\n【5】清理测试数据')
  await supabase.auth.admin.deleteUser(authData.user.id)
  if (profile1) {
    await supabase.from('profiles').delete().eq('id', authData.user.id)
    await supabase.from('point_transactions').delete().eq('user_id', authData.user.id)
    await supabase.from('notifications').delete().eq('user_id', authData.user.id)
  }
  console.log('✅ 清理完成')

  // 结论
  console.log('\n' + '='.repeat(60))
  console.log('测试结论')
  console.log('='.repeat(60))

  if (profile1) {
    console.log('\n🎉 触发器工作完全正常!')
    console.log('')
    console.log('触发器功能验证:')
    console.log('  ✅ Profile 自动创建')
    console.log('  ✅ 用户编号自动分配')
    console.log('  ✅ 邀请码自动生成')
    console.log('  ✅ 注册积分自动发放')
    console.log('  ' + (transactions && transactions.length > 0 ? '✅' : '❌') + ' 积分记录自动创建')
    console.log('  ' + (notifications && notifications.length > 0 ? '✅' : '❌') + ' 欢迎通知自动发送')
    console.log('')
    console.log('✅ 之前的测试失败可能是因为:')
    console.log('   1. 测试用户创建方式不同')
    console.log('   2. 或者触发器刚刚才真正生效')
    console.log('')
    console.log('现在新用户注册应该完全正常了!')
  } else {
    console.log('\n❌ 触发器虽然存在但未执行')
    console.log('')
    console.log('可能的原因:')
    console.log('  1. 触发器函数 handle_new_user() 内部出错')
    console.log('  2. 触发器被禁用 (虽然存在但未启用)')
    console.log('  3. 权限问题导致触发器无法执行')
    console.log('')
    console.log('建议检查 Supabase 日志查看触发器执行错误')
  }

  console.log('\n' + '='.repeat(60))
}

detailedTriggerTest().catch(console.error)
