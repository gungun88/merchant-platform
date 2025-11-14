// 检查 bu9w1@2200freefonts.com 用户的详细信息
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
  // 检查最新注册的用户
  console.log('=== 查找最新注册的用户 ===\n')

  const { data: recentProfiles } = await supabase
    .from('profiles')
    .select('id, username, created_at')
    .order('created_at', { ascending: false })
    .limit(3)

  console.log('最近3个用户:')
  recentProfiles?.forEach((p, i) => {
    console.log(`${i + 1}. ${p.username} (${p.created_at})`)
  })

  const email = 'bu9w1@2200freefonts.com'
  console.log(`\n=== 详细检查用户 ${email} ===\n`)

  // 查找用户
  const { data: authUsers } = await supabase.auth.admin.listUsers()
  const authUser = authUsers.users.find(u => u.email === email)

  if (!authUser) {
    console.log('找不到用户')
    return
  }

  console.log('Auth User ID:', authUser.id)
  console.log('注册时间:', authUser.created_at)

  // 查找 profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', authUser.id)
    .single()

  console.log('\nProfile:', profile)

  // 查找邀请记录
  console.log('\n=== 邀请记录 ===')
  const { data: invitations } = await supabase
    .from('invitations')
    .select('*')
    .eq('invitee_id', authUser.id)

  if (invitations && invitations.length > 0) {
    console.log('找到邀请记录:', invitations[0])
    console.log(`使用邀请码: ${invitations[0].invitation_code}`)
    console.log(`邀请人ID: ${invitations[0].inviter_id}`)
    console.log(`状态: ${invitations[0].status}`)
  } else {
    console.log('未找到邀请记录 - 该用户未使用邀请码注册')
  }

  // 查找积分记录
  console.log('\n=== 积分记录 (point_transactions) ===')
  const { data: pointTrans } = await supabase
    .from('point_transactions')
    .select('*')
    .eq('user_id', authUser.id)
    .order('created_at', { ascending: true })

  if (pointTrans && pointTrans.length > 0) {
    pointTrans.forEach((trans, index) => {
      console.log(`\n[${index + 1}] ${trans.type}`)
      console.log(`   描述: ${trans.description}`)
      console.log(`   金额: ${trans.amount > 0 ? '+' : ''}${trans.amount}`)
      console.log(`   余额: ${trans.balance_after}`)
      console.log(`   时间: ${trans.created_at}`)
    })
  } else {
    console.log('无积分记录')
  }

  // 查找通知
  console.log('\n=== 通知 ===')
  const { data: notifications } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', authUser.id)
    .order('created_at', { ascending: true })

  if (notifications && notifications.length > 0) {
    notifications.forEach((notif, index) => {
      console.log(`\n[${index + 1}] ${notif.category}: ${notif.title}`)
      console.log(`   内容: ${notif.content}`)
      console.log(`   时间: ${notif.created_at}`)
    })
  } else {
    console.log('无通知')
  }

  // 查找旧的 points_log
  console.log('\n=== 旧积分记录 (points_log) ===')
  const { data: oldPoints } = await supabase
    .from('points_log')
    .select('*')
    .eq('user_id', authUser.id)

  if (oldPoints && oldPoints.length > 0) {
    oldPoints.forEach((log, index) => {
      console.log(`\n[${index + 1}] ${log.action_type}`)
      console.log(`   描述: ${log.description}`)
      console.log(`   积分: ${log.points_change}`)
    })
  } else {
    console.log('无旧积分记录')
  }

  console.log('\n\n=== 诊断结果 ===')
  console.log(`当前积分: ${profile?.points || 0}`)
  console.log(`积分记录数: ${pointTrans?.length || 0}`)
  console.log(`通知数: ${notifications?.length || 0}`)
  console.log(`是否使用邀请码: ${invitations && invitations.length > 0 ? '是' : '否'}`)

  if (invitations && invitations.length > 0) {
    console.log('\n预期结果: 200积分, 2条积分记录, 2条通知')
    const expectedPoints = 200
    const actualPoints = profile?.points || 0
    const pointsDiff = expectedPoints - actualPoints

    if (pointsDiff !== 0) {
      console.log(`\n❌ 问题: 积分差额 ${pointsDiff}`)
      console.log(`   应该有: ${expectedPoints}积分`)
      console.log(`   实际有: ${actualPoints}积分`)
    }
  }
}

checkUser().catch(console.error)
