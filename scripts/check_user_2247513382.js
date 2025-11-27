// 检查 2247513382@qq.com 用户的详细信息
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

async function checkUser() {
  const email = '2247513382@qq.com'
  console.log(`\n=== 详细检查用户 ${email} ===\n`)

  // 1. 检查 auth.users 表
  console.log('步骤1: 检查 auth.users 表...')
  const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers()

  if (authError) {
    console.error('查询 auth.users 错误:', authError)
  }

  const authUser = authUsers?.users?.find(u => u.email === email)

  if (!authUser) {
    console.log('❌ 在 auth.users 表中找不到该用户')
    console.log('\n正在查找邮箱相似的用户...')
    const similarUsers = authUsers?.users?.filter(u =>
      u.email?.includes('2247513382') || u.email?.includes('qq.com')
    ).slice(0, 5)

    if (similarUsers && similarUsers.length > 0) {
      console.log('找到可能相关的用户:')
      similarUsers.forEach(u => {
        console.log(`  - ${u.email} (ID: ${u.id}, 注册时间: ${u.created_at})`)
      })
    }
    return
  }

  console.log('✅ 在 auth.users 表中找到用户')
  console.log('   User ID:', authUser.id)
  console.log('   Email:', authUser.email)
  console.log('   Email 确认:', authUser.email_confirmed_at ? '已确认' : '未确认')
  console.log('   注册时间:', authUser.created_at)
  console.log('   最后登录:', authUser.last_sign_in_at || '从未登录')

  // 2. 检查 profiles 表
  console.log('\n步骤2: 检查 profiles 表...')
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', authUser.id)
    .single()

  if (profileError) {
    console.log('❌ 在 profiles 表中找不到该用户')
    console.error('   错误:', profileError.message)
  } else {
    console.log('✅ 在 profiles 表中找到用户')
    console.log('   用户名:', profile.username)
    console.log('   用户编号:', profile.user_number || '未设置')
    console.log('   积分:', profile.points || 0)
    console.log('   邀请码:', profile.invitation_code || '未生成')
    console.log('   创建时间:', profile.created_at)
    console.log('   角色:', profile.role || 'user')
  }

  // 3. 检查邀请记录
  console.log('\n步骤3: 检查邀请记录...')
  const { data: invitations } = await supabase
    .from('invitations')
    .select('*')
    .eq('invitee_id', authUser.id)

  if (invitations && invitations.length > 0) {
    console.log('✅ 找到邀请记录:')
    invitations.forEach((inv, i) => {
      console.log(`   [${i+1}] 使用邀请码: ${inv.invitation_code}`)
      console.log(`       邀请人ID: ${inv.inviter_id}`)
      console.log(`       状态: ${inv.status}`)
      console.log(`       注册时间: ${inv.registered_at}`)
    })
  } else {
    console.log('   该用户未使用邀请码注册')
  }

  // 4. 检查积分记录
  console.log('\n步骤4: 检查积分记录 (point_transactions)...')
  const { data: pointTrans } = await supabase
    .from('point_transactions')
    .select('*')
    .eq('user_id', authUser.id)
    .order('created_at', { ascending: true })

  if (pointTrans && pointTrans.length > 0) {
    console.log(`✅ 找到 ${pointTrans.length} 条积分记录:`)
    pointTrans.forEach((trans, index) => {
      console.log(`   [${index + 1}] ${trans.type}: ${trans.description}`)
      console.log(`       金额: ${trans.amount > 0 ? '+' : ''}${trans.amount}`)
      console.log(`       余额: ${trans.balance_after}`)
      console.log(`       时间: ${trans.created_at}`)
    })
  } else {
    console.log('   无积分记录')
  }

  // 5. 检查通知
  console.log('\n步骤5: 检查通知记录...')
  const { data: notifications } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', authUser.id)
    .order('created_at', { ascending: true })

  if (notifications && notifications.length > 0) {
    console.log(`✅ 找到 ${notifications.length} 条通知:`)
    notifications.forEach((notif, index) => {
      console.log(`   [${index + 1}] ${notif.category}: ${notif.title}`)
      console.log(`       内容: ${notif.content}`)
      console.log(`       已读: ${notif.is_read ? '是' : '否'}`)
      console.log(`       时间: ${notif.created_at}`)
    })
  } else {
    console.log('   无通知记录')
  }

  // 6. 检查为什么管理后台搜索不到
  console.log('\n步骤6: 分析为什么管理后台搜索不到...')

  const issues = []

  if (!profile) {
    issues.push('❌ profiles 表中没有记录 - 这是主要问题!')
  }

  if (!authUser.email_confirmed_at) {
    issues.push('⚠️ 邮箱未确认')
  }

  if (!profile?.user_number) {
    issues.push('⚠️ 用户编号未生成')
  }

  if (!profile?.invitation_code) {
    issues.push('⚠️ 邀请码未生成')
  }

  if (issues.length > 0) {
    console.log('\n发现的问题:')
    issues.forEach(issue => console.log(`  ${issue}`))
  } else {
    console.log('✅ 用户数据看起来正常')
    console.log('\n可能的原因:')
    console.log('  1. 管理后台的搜索功能有问题')
    console.log('  2. 搜索时使用的字段不包含该用户')
    console.log('  3. 缓存问题,尝试刷新页面')
  }

  // 7. 总结
  console.log('\n' + '='.repeat(50))
  console.log('诊断总结')
  console.log('='.repeat(50))
  console.log(`邮箱: ${email}`)
  console.log(`用户ID: ${authUser.id}`)
  console.log(`注册状态: ${authUser ? '已注册' : '未注册'}`)
  console.log(`Profile存在: ${profile ? '是' : '否'}`)
  console.log(`邮箱确认: ${authUser.email_confirmed_at ? '已确认' : '未确认'}`)
  console.log(`用户名: ${profile?.username || '未设置'}`)
  console.log(`用户编号: ${profile?.user_number || '未生成'}`)
  console.log(`当前积分: ${profile?.points || 0}`)
  console.log(`积分记录数: ${pointTrans?.length || 0}`)
  console.log(`通知数: ${notifications?.length || 0}`)
}

checkUser().catch(console.error)
