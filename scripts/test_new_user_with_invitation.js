// 测试新用户使用邀请码注册的完整流程
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

async function testNewUserRegistration() {
  console.log('=== 测试新用户注册流程 ===\n')

  // 1. 获取一个有效的邀请码
  console.log('步骤1: 获取一个有效的邀请码...')
  const { data: inviter } = await supabase
    .from('profiles')
    .select('id, username, invitation_code, points')
    .not('invitation_code', 'is', null)
    .limit(1)
    .single()

  if (!inviter) {
    console.log('找不到有邀请码的用户')
    return
  }

  console.log(`找到邀请人: ${inviter.username}`)
  console.log(`邀请码: ${inviter.invitation_code}`)
  console.log(`邀请人当前积分: ${inviter.points}`)
  console.log('')

  console.log('=== 模拟新用户注册流程 ===')
  console.log('假设新用户使用邀请码注册...')
  console.log('')
  console.log('注册流程应该触发:')
  console.log('1. handle_new_user() 触发器执行:')
  console.log('   - 创建 profile (100积分)')
  console.log('   - 创建注册积分记录 (registration, +100)')
  console.log('   - 创建注册欢迎通知')
  console.log('')
  console.log('2. processInvitationReward() 函数执行:')
  console.log('   - 创建邀请记录')
  console.log('   - 邀请人获得100积分 (invitation_reward)')
  console.log('   - 被邀请人获得100积分 (invited_reward)')
  console.log('   - 发送邀请人通知')
  console.log('   - 发送被邀请人通知')
  console.log('')
  console.log('最终结果:')
  console.log('- 新用户: 200积分 (100注册 + 100邀请), 2条通知, 2条积分记录')
  console.log('- 邀请人: +100积分, 1条通知, 1条积分记录')
  console.log('')

  // 2. 检查最近注册的用户
  console.log('=== 检查最近注册的用户 ===\n')

  const { data: recentUsers } = await supabase
    .from('profiles')
    .select('id, username, points, created_at')
    .order('created_at', { ascending: false })
    .limit(5)

  console.log('最近5个注册用户:')
  for (const user of recentUsers) {
    console.log(`\n用户: ${user.username}`)
    console.log(`积分: ${user.points}`)
    console.log(`注册时间: ${user.created_at}`)

    // 查看积分记录
    const { data: pointRecords } = await supabase
      .from('point_transactions')
      .select('type, amount, description, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })

    console.log(`积分记录 (${pointRecords.length}条):`)
    pointRecords.forEach(record => {
      console.log(`  - ${record.type}: ${record.amount > 0 ? '+' : ''}${record.amount} | ${record.description}`)
    })

    // 查看通知
    const { data: notifications } = await supabase
      .from('notifications')
      .select('category, title, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })

    console.log(`通知 (${notifications.length}条):`)
    notifications.forEach(notif => {
      console.log(`  - ${notif.category}: ${notif.title}`)
    })

    // 查看邀请记录
    const { data: invitations } = await supabase
      .from('invitations')
      .select('*')
      .eq('invitee_id', user.id)

    if (invitations && invitations.length > 0) {
      console.log(`邀请记录: 使用了邀请码 ${invitations[0].invitation_code}`)
    } else {
      console.log(`邀请记录: 无 (未使用邀请码注册)`)
    }
  }

  console.log('\n\n=== 验证结论 ===')
  console.log('检查最近注册的用户:')
  console.log('✓ 未使用邀请码: 应有100积分, 1条registration积分记录, 1条registration通知')
  console.log('✓ 使用邀请码: 应有200积分, 2条积分记录(registration + invited_reward), 2条通知')
}

testNewUserRegistration().catch(console.error)
