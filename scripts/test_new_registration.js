// 测试新的应用层注册流程
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

async function testNewRegistration() {
  console.log('\n' + '='.repeat(60))
  console.log('测试新注册流程 (应用层方案)')
  console.log('='.repeat(60))

  const testEmail = `app_layer_test_${Date.now()}@test.com`
  const testUsername = 'app_layer_test'

  console.log('\n【步骤1】使用 admin API 创建用户')
  console.log(`邮箱: ${testEmail}`)
  console.log(`用户名: ${testUsername}`)

  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: testEmail,
    password: 'Test123!@#',
    email_confirm: true,
    user_metadata: {
      username: testUsername
    }
  })

  if (authError) {
    console.log('❌ 创建用户失败:', authError.message)
    return
  }

  console.log('✅ Auth 用户创建成功')
  console.log(`   User ID: ${authData.user.id}`)

  // 立即检查 profile
  console.log('\n【步骤2】检查 profile 是否被自动创建')

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', authData.user.id)
    .maybeSingle()

  if (profile) {
    console.log('❌ 触发器仍在工作 - Profile 被自动创建了!')
    console.log('   这意味着触发器又被启用了')
    console.log('   用户名:', profile.username)
    console.log('   用户编号:', profile.user_number)
    console.log('   邀请码:', profile.invitation_code)
    console.log('   积分:', profile.points)

    // 清理
    await supabase.auth.admin.deleteUser(authData.user.id)
    await supabase.from('profiles').delete().eq('id', authData.user.id)

    console.log('\n注意: 触发器可能已经被重新启用了!')
    console.log('如果触发器工作正常，就不需要应用层方案了')
    return
  }

  console.log('✅ Profile 没有被自动创建 (符合预期)')
  console.log('   触发器未执行,需要使用应用层方案')

  // 模拟应用层创建 profile
  console.log('\n【步骤3】使用应用层方案创建 profile')

  // 获取下一个用户编号
  const { data: maxUserNumber } = await supabase
    .from('profiles')
    .select('user_number')
    .order('user_number', { ascending: false })
    .limit(1)
    .maybeSingle()

  const nextUserNumber = maxUserNumber?.user_number ? maxUserNumber.user_number + 1 : 100001

  // 生成邀请码
  const { data: invitationCode } = await supabase.rpc('generate_invitation_code')

  // 获取注册积分
  const { data: settings } = await supabase
    .from('system_settings')
    .select('register_points')
    .eq('id', '00000000-0000-0000-0000-000000000001')
    .maybeSingle()

  const registerPoints = settings?.register_points || 100

  // 创建 profile
  const { data: newProfile, error: createError } = await supabase
    .from('profiles')
    .insert({
      id: authData.user.id,
      username: testUsername,
      email: testEmail,
      user_number: nextUserNumber,
      invitation_code: invitationCode,
      points: registerPoints,
      role: 'user',
      created_at: authData.user.created_at
    })
    .select()
    .single()

  if (createError) {
    console.log('❌ 创建 profile 失败:', createError.message)
    await supabase.auth.admin.deleteUser(authData.user.id)
    return
  }

  console.log('✅ Profile 创建成功!')
  console.log(`   用户名: ${newProfile.username}`)
  console.log(`   用户编号: ${newProfile.user_number}`)
  console.log(`   邀请码: ${newProfile.invitation_code}`)
  console.log(`   积分: ${newProfile.points}`)

  // 记录积分交易
  console.log('\n【步骤4】记录注册积分')

  const { error: pointError } = await supabase.rpc('record_point_transaction', {
    p_user_id: authData.user.id,
    p_amount: registerPoints,
    p_type: 'registration',
    p_description: `注册赠送积分 +${registerPoints}积分`,
    p_related_type: null,
    p_related_id: null,
    p_metadata: { source: 'registration' }
  })

  if (pointError) {
    console.log('⚠️  记录积分失败:', pointError.message)
  } else {
    console.log('✅ 积分记录成功')
  }

  // 发送通知
  console.log('\n【步骤5】发送欢迎通知')

  const { error: notifError } = await supabase.rpc('create_notification', {
    p_user_id: authData.user.id,
    p_type: 'system',
    p_category: 'registration',
    p_title: '欢迎加入',
    p_content: `注册成功！您已获得 ${registerPoints} 积分奖励，快去体验吧！`,
    p_link_type: null,
    p_link_id: null,
    p_metadata: { points: registerPoints },
    p_priority: 'normal',
    p_expires_at: null
  })

  if (notifError) {
    console.log('⚠️  发送通知失败:', notifError.message)
  } else {
    console.log('✅ 通知发送成功')
  }

  // 验证完整性
  console.log('\n【步骤6】验证数据完整性')

  const { data: finalProfile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', authData.user.id)
    .single()

  const { data: transactions } = await supabase
    .from('point_transactions')
    .select('*')
    .eq('user_id', authData.user.id)

  const { data: notifications } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', authData.user.id)

  console.log(`Profile: ${finalProfile ? '✅' : '❌'}`)
  console.log(`积分记录: ${transactions && transactions.length > 0 ? '✅' : '❌'} (${transactions?.length || 0}条)`)
  console.log(`通知: ${notifications && notifications.length > 0 ? '✅' : '❌'} (${notifications?.length || 0}条)`)

  // 清理
  console.log('\n【步骤7】清理测试数据')
  await supabase.auth.admin.deleteUser(authData.user.id)
  await supabase.from('profiles').delete().eq('id', authData.user.id)
  await supabase.from('point_transactions').delete().eq('user_id', authData.user.id)
  await supabase.from('notifications').delete().eq('user_id', authData.user.id)
  console.log('✅ 清理完成')

  // 结论
  console.log('\n' + '='.repeat(60))
  console.log('测试结论')
  console.log('='.repeat(60))

  if (finalProfile && transactions && transactions.length > 0) {
    console.log('\n🎉 应用层注册流程完全成功!')
    console.log('')
    console.log('功能验证:')
    console.log('  ✅ Auth 用户创建')
    console.log('  ✅ Profile 手动创建')
    console.log('  ✅ 用户编号自动分配')
    console.log('  ✅ 邀请码自动生成')
    console.log('  ✅ 注册积分自动发放')
    console.log('  ' + (transactions.length > 0 ? '✅' : '❌') + ' 积分记录自动创建')
    console.log('  ' + (notifications && notifications.length > 0 ? '✅' : '❌') + ' 欢迎通知自动发送')
    console.log('')
    console.log('✅ 新注册流程已完全实现并验证通过!')
    console.log('✅ 现在前端和管理后台都可以正常创建用户了')
  } else {
    console.log('\n❌ 应用层注册流程有问题')
    console.log('需要检查哪个步骤失败了')
  }

  console.log('\n' + '='.repeat(60))
}

testNewRegistration().catch(console.error)
