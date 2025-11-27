// 详细检查数据库触发器状态
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

async function checkTriggerDetails() {
  console.log('\n' + '='.repeat(60))
  console.log('数据库触发器详细检查')
  console.log('='.repeat(60))

  // 1. 检查触发器是否存在
  console.log('\n【1】检查触发器是否存在\n')

  try {
    // 使用 rpc 调用查询触发器
    const { data: triggers, error: triggerError } = await supabase.rpc('query', {
      query: `
        SELECT
          trigger_name,
          event_manipulation,
          event_object_schema,
          event_object_table,
          action_timing,
          action_statement,
          action_orientation
        FROM information_schema.triggers
        WHERE event_object_schema = 'auth'
          AND event_object_table = 'users'
        ORDER BY trigger_name;
      `
    })

    if (triggerError) {
      console.log('⚠️  无法直接查询触发器信息')
      console.log('   错误:', triggerError.message)
      console.log('   这是因为 Supabase 限制了对 information_schema 的访问')
    } else if (triggers && triggers.length > 0) {
      console.log(`✅ 找到 ${triggers.length} 个触发器:`)
      triggers.forEach(t => {
        console.log(`   - ${t.trigger_name}`)
        console.log(`     时机: ${t.action_timing} ${t.event_manipulation}`)
        console.log(`     函数: ${t.action_statement}`)
      })
    } else {
      console.log('❌ 没有找到任何触发器')
    }
  } catch (err) {
    console.log('⚠️  查询失败:', err.message)
  }

  // 2. 检查触发器函数是否存在
  console.log('\n【2】检查触发器函数是否存在\n')

  try {
    // 尝试调用函数 - 如果函数不存在会报错
    const { error: funcError } = await supabase.rpc('handle_new_user')

    if (funcError) {
      if (funcError.message.includes('does not exist') || funcError.message.includes('not found')) {
        console.log('❌ 函数 handle_new_user 不存在')
      } else {
        console.log('✅ 函数 handle_new_user 存在 (调用失败是正常的,因为它需要触发器上下文)')
        console.log('   错误信息:', funcError.message)
      }
    } else {
      console.log('✅ 函数 handle_new_user 存在')
    }
  } catch (err) {
    console.log('⚠️  检查函数失败:', err.message)
  }

  // 3. 实际测试触发器
  console.log('\n【3】实际测试触发器功能\n')

  const testEmail = `trigger_test_${Date.now()}@test.com`
  console.log(`创建测试用户: ${testEmail}`)

  const { data: testUser, error: createError } = await supabase.auth.admin.createUser({
    email: testEmail,
    password: 'Test123!@#',
    email_confirm: true,
    user_metadata: {
      username: 'test_user'
    }
  })

  if (createError) {
    console.log('❌ 创建测试用户失败:', createError.message)
    return
  }

  console.log('✅ 测试用户创建成功')
  console.log(`   用户 ID: ${testUser.user.id}`)

  // 等待触发器执行
  console.log('   等待2秒让触发器执行...')
  await new Promise(resolve => setTimeout(resolve, 2000))

  // 检查 profile 是否被创建
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', testUser.user.id)
    .maybeSingle()

  if (profile) {
    console.log('\n✅ 触发器工作正常! Profile 已自动创建:')
    console.log('   用户名:', profile.username)
    console.log('   邮箱:', profile.email)
    console.log('   用户编号:', profile.user_number)
    console.log('   邀请码:', profile.invitation_code)
    console.log('   积分:', profile.points)

    // 检查积分记录
    const { data: transactions } = await supabase
      .from('point_transactions')
      .select('*')
      .eq('user_id', testUser.user.id)

    if (transactions && transactions.length > 0) {
      console.log('   积分记录:', transactions.length, '条')
    }

    // 检查通知
    const { data: notifications } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', testUser.user.id)

    if (notifications && notifications.length > 0) {
      console.log('   通知:', notifications.length, '条')
    }
  } else {
    console.log('\n❌ 触发器未工作! Profile 没有被创建')
    if (profileError) {
      console.log('   错误:', profileError.message)
    }
  }

  // 清理测试用户
  console.log('\n清理测试数据...')
  await supabase.auth.admin.deleteUser(testUser.user.id)
  if (profile) {
    await supabase.from('profiles').delete().eq('id', testUser.user.id)
  }
  console.log('✅ 测试数据已清理')

  // 4. 诊断结果
  console.log('\n' + '='.repeat(60))
  console.log('诊断结果')
  console.log('='.repeat(60))

  if (profile) {
    console.log('✅ 触发器已成功启用并正常工作')
    console.log('')
    console.log('现在新用户注册时会自动:')
    console.log('  1. 创建 profile 记录')
    console.log('  2. 分配用户编号和邀请码')
    console.log('  3. 发放注册积分')
    console.log('  4. 发送欢迎通知')
  } else {
    console.log('❌ 触发器未启用或未正常工作')
    console.log('')
    console.log('可能的原因:')
    console.log('  1. SQL 脚本未在数据库中执行')
    console.log('  2. 触发器执行时出错但被捕获了')
    console.log('  3. 没有足够的权限创建触发器')
    console.log('')
    console.log('解决方法:')
    console.log('  1. 在 Supabase Dashboard 的 SQL Editor 中手动执行:')
    console.log('     scripts/061_final_fix_user_trigger.sql')
    console.log('  2. 检查 Supabase 日志中是否有错误信息')
    console.log('  3. 确认有数据库管理员权限')
  }

  console.log('\n' + '='.repeat(60))
}

checkTriggerDetails().catch(console.error)
