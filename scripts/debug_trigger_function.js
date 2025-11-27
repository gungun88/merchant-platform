// 直接测试触发器函数，找出为什么不执行
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

async function debugTriggerFunction() {
  console.log('\n' + '='.repeat(60))
  console.log('调试触发器函数')
  console.log('='.repeat(60))

  console.log('\n触发器状态: ✅ ENABLED')
  console.log('问题: 触发器虽然启用,但没有执行\n')

  // 1. 检查 user_number 字段是否存在
  console.log('【1】检查 profiles 表是否有 user_number 字段\n')

  const { data: profileSample, error: sampleError } = await supabase
    .from('profiles')
    .select('*')
    .limit(1)
    .maybeSingle()

  if (profileSample) {
    const hasUserNumber = 'user_number' in profileSample
    console.log('user_number 字段:', hasUserNumber ? '✅ 存在' : '❌ 不存在')

    if (!hasUserNumber) {
      console.log('\n❌ 关键问题发现!')
      console.log('   profiles 表缺少 user_number 字段!')
      console.log('   这会导致触发器函数执行失败')
    }
  }

  // 2. 手动模拟触发器，逐步执行看哪里出错
  console.log('\n【2】手动模拟触发器逻辑，找出问题点\n')

  const testEmail = `debug_test_${Date.now()}@test.com`
  console.log(`创建测试用户: ${testEmail}`)

  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: testEmail,
    password: 'Test123!@#',
    email_confirm: true,
    user_metadata: {
      username: 'debug_test'
    }
  })

  if (authError) {
    console.log('❌ 创建用户失败:', authError.message)
    return
  }

  const userId = authData.user.id
  console.log('✅ 用户创建成功:', userId)

  // 等待看触发器是否执行
  console.log('\n等待3秒检查触发器是否执行...')
  await new Promise(resolve => setTimeout(resolve, 3000))

  const { data: autoProfile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle()

  if (autoProfile) {
    console.log('✅ 触发器自动创建了 profile!')
    console.log('   原来触发器是工作的!')

    // 清理
    await supabase.auth.admin.deleteUser(userId)
    await supabase.from('profiles').delete().eq('id', userId)
    console.log('\n✅ 看来问题已经解决了!')
    return
  }

  console.log('❌ 触发器没有创建 profile\n')
  console.log('开始手动模拟触发器逻辑...\n')

  // 步骤 1: 获取注册积分
  console.log('步骤1: 获取 system_settings 中的注册积分')
  const { data: settings } = await supabase
    .from('system_settings')
    .select('register_points')
    .eq('id', '00000000-0000-0000-0000-000000000001')
    .maybeSingle()

  const registerPoints = settings?.register_points || 100
  console.log('   注册积分:', registerPoints)

  // 步骤 2: 生成邀请码
  console.log('\n步骤2: 生成邀请码')
  const { data: invitationCode, error: codeError } = await supabase
    .rpc('generate_invitation_code')

  if (codeError) {
    console.log('   ❌ 生成邀请码失败:', codeError.message)
    console.log('   这可能是触发器失败的原因!')
  } else {
    console.log('   ✅ 邀请码:', invitationCode)
  }

  // 步骤 3: 获取下一个用户编号
  console.log('\n步骤3: 获取下一个用户编号')
  const { data: maxNum } = await supabase
    .from('profiles')
    .select('user_number')
    .order('user_number', { ascending: false })
    .limit(1)
    .maybeSingle()

  const nextUserNumber = maxNum?.user_number ? maxNum.user_number + 1 : 100001
  console.log('   下一个用户编号:', nextUserNumber)

  // 步骤 4: 创建 profile
  console.log('\n步骤4: 创建 profile')
  try {
    const { data: newProfile, error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: userId,
        username: authData.user.user_metadata?.username || authData.user.email.split('@')[0],
        email: authData.user.email,
        user_number: nextUserNumber,
        invitation_code: invitationCode || 'TEMP00',
        points: registerPoints,
        role: 'user',
        is_merchant: false,
        consecutive_checkin_days: 0,
        report_count: 0,
        is_banned: false,
        login_failed_attempts: 0,
        created_at: authData.user.created_at,
        updated_at: new Date().toISOString()
      })
      .select()
      .single()

    if (profileError) {
      console.log('   ❌ 创建失败:', profileError.message)
      console.log('   ❌ 这就是触发器失败的原因!')
      console.log('')
      console.log('   错误详情:')
      console.log('   ', JSON.stringify(profileError, null, 2))
    } else {
      console.log('   ✅ Profile 创建成功!')
      console.log('   这说明手动创建没问题，问题在触发器权限或执行环境')
    }
  } catch (err) {
    console.log('   ❌ 创建出错:', err.message)
  }

  // 清理
  console.log('\n清理测试数据...')
  await supabase.auth.admin.deleteUser(userId)
  await supabase.from('profiles').delete().eq('id', userId)
  console.log('✅ 清理完成')

  // 结论
  console.log('\n' + '='.repeat(60))
  console.log('诊断结论')
  console.log('='.repeat(60))
  console.log('')
  console.log('触发器存在且启用，但没有执行。')
  console.log('')
  console.log('最可能的原因:')
  console.log('  1. 触发器函数在 auth schema 中没有足够权限')
  console.log('  2. 触发器函数执行时出错但被静默捕获了')
  console.log('  3. Supabase 的 auth.users 表有特殊限制')
  console.log('')
  console.log('推荐解决方案:')
  console.log('  由于触发器无法可靠工作，建议使用应用层方案:')
  console.log('  在注册成功后手动调用 server action 创建 profile')
  console.log('')
  console.log('  优点:')
  console.log('    ✅ 更好的错误控制')
  console.log('    ✅ 可以在前端显示错误信息')
  console.log('    ✅ 不依赖数据库触发器')
  console.log('    ✅ 更容易调试和维护')
  console.log('')
}

debugTriggerFunction().catch(console.error)
