// 检查当前这个用户的通知详情
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

async function checkUserNotifications() {
  const email = 'livingjanka@2200freefonts.com'

  console.log(`=== 检查用户 ${email} 的通知 ===\n`)

  // 1. 查找用户
  let profile = null
  const { data: profileData, error: profileError } = await supabase
    .from('profiles')
    .select('id, username, points')
    .eq('username', email)
    .single()

  if (profileError || !profileData) {
    console.log('通过username找不到用户，尝试从 auth.users 查找...')
    const { data: authUser } = await supabase.auth.admin.listUsers()
    const user = authUser.users.find(u => u.email === email)
    if (user) {
      console.log('找到 auth 用户:', user.id)
      const { data: p } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()
      console.log('Profile:', p)
      profile = p
    } else {
      console.log('找不到用户')
      return
    }
  } else {
    profile = profileData
  }

  console.log('用户信息:', profile)
  console.log('')

  // 2. 查看所有通知
  const { data: notifications, error: notifError } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', profile.id)
    .order('created_at', { ascending: false })

  console.log(`该用户的所有通知 (共${notifications?.length || 0}条):`)
  notifications?.forEach((notif, index) => {
    console.log(`\n[${index + 1}] ${notif.title}`)
    console.log(`   内容: ${notif.content}`)
    console.log(`   类型: ${notif.type} / ${notif.category}`)
    console.log(`   创建时间: ${notif.created_at}`)
    console.log(`   已读: ${notif.is_read}`)
    if (notif.related_user_id) {
      console.log(`   相关用户ID: ${notif.related_user_id}`)
    }
    console.log(`   元数据:`, notif.metadata)
  })

  // 3. 查看所有积分记录
  console.log('\n\n=== 积分记录 (point_transactions) ===')
  const { data: pointTrans } = await supabase
    .from('point_transactions')
    .select('*')
    .eq('user_id', profile.id)
    .order('created_at', { ascending: false })

  pointTrans?.forEach((trans, index) => {
    console.log(`\n[${index + 1}] ${trans.type}`)
    console.log(`   描述: ${trans.description}`)
    console.log(`   金额: ${trans.amount > 0 ? '+' : ''}${trans.amount}`)
    console.log(`   余额: ${trans.balance_after}`)
    console.log(`   创建时间: ${trans.created_at}`)
  })

  // 4. 查看旧的积分记录
  console.log('\n\n=== 旧积分记录 (points_log) ===')
  const { data: oldPointsLog } = await supabase
    .from('points_log')
    .select('*')
    .eq('user_id', profile.id)
    .order('created_at', { ascending: false })

  if (oldPointsLog && oldPointsLog.length > 0) {
    oldPointsLog.forEach((log, index) => {
      console.log(`\n[${index + 1}] ${log.action_type}`)
      console.log(`   描述: ${log.description}`)
      console.log(`   积分变动: ${log.points_change > 0 ? '+' : ''}${log.points_change}`)
      console.log(`   创建时间: ${log.created_at}`)
    })
  } else {
    console.log('无旧积分记录')
  }

  // 5. 查看邀请记录
  console.log('\n\n=== 邀请记录 ===')
  const { data: invitations } = await supabase
    .from('invitations')
    .select('*')
    .or(`inviter_id.eq.${profile.id},invitee_id.eq.${profile.id}`)

  if (invitations && invitations.length > 0) {
    invitations.forEach((inv, index) => {
      const isInviter = inv.inviter_id === profile.id
      console.log(`\n[${index + 1}] ${isInviter ? '我邀请了别人' : '我被别人邀请'}`)
      console.log(`   邀请码: ${inv.invitation_code}`)
      console.log(`   状态: ${inv.status}`)
      console.log(`   创建时间: ${inv.created_at}`)
      console.log(`   完成时间: ${inv.completed_at}`)
    })
  } else {
    console.log('无邀请记录')
  }
}

checkUserNotifications().catch(console.error)
