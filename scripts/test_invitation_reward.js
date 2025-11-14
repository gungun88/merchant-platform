// 测试邀请奖励功能的脚本
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

async function testInvitationReward() {
  console.log('=== 测试邀请奖励系统 ===\n')

  // 1. 检查邀请记录
  const { data: invitations, error: invError } = await supabase
    .from('invitations')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5)

  console.log('最近的邀请记录:', JSON.stringify(invitations, null, 2))
  if (invError) console.error('查询邀请记录错误:', invError)

  if (invitations && invitations.length > 0) {
    const latestInvitation = invitations[0]

    // 2. 检查邀请人的积分记录
    console.log('\n检查邀请人积分记录:')
    const { data: inviterPoints, error: ipError } = await supabase
      .from('point_transactions')
      .select('*')
      .eq('user_id', latestInvitation.inviter_id)
      .eq('type', 'invitation_reward')
      .order('created_at', { ascending: false })

    console.log('邀请人积分记录:', JSON.stringify(inviterPoints, null, 2))
    if (ipError) console.error('查询错误:', ipError)

    // 3. 检查被邀请人的积分记录
    if (latestInvitation.invitee_id) {
      console.log('\n检查被邀请人积分记录:')
      const { data: inviteePoints, error: ieError } = await supabase
        .from('point_transactions')
        .select('*')
        .eq('user_id', latestInvitation.invitee_id)
        .eq('type', 'invited_reward')
        .order('created_at', { ascending: false })

      console.log('被邀请人积分记录:', JSON.stringify(inviteePoints, null, 2))
      if (ieError) console.error('查询错误:', ieError)

      // 4. 检查邀请人的通知
      console.log('\n检查邀请人通知:')
      const { data: inviterNotif, error: inError } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', latestInvitation.inviter_id)
        .eq('category', 'invitation_reward')
        .order('created_at', { ascending: false })

      console.log('邀请人通知:', JSON.stringify(inviterNotif, null, 2))
      if (inError) console.error('查询错误:', inError)

      // 5. 检查被邀请人的通知
      console.log('\n检查被邀请人通知:')
      const { data: inviteeNotif, error: ieNotifError } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', latestInvitation.invitee_id)
        .eq('category', 'invited_reward')
        .order('created_at', { ascending: false })

      console.log('被邀请人通知:', JSON.stringify(inviteeNotif, null, 2))
      if (ieNotifError) console.error('查询错误:', ieNotifError)

      // 6. 检查双方的当前积分
      console.log('\n检查双方当前积分:')
      const { data: inviterProfile } = await supabase
        .from('profiles')
        .select('id, username, points')
        .eq('id', latestInvitation.inviter_id)
        .single()

      const { data: inviteeProfile } = await supabase
        .from('profiles')
        .select('id, username, points')
        .eq('id', latestInvitation.invitee_id)
        .single()

      console.log('邀请人:', inviterProfile)
      console.log('被邀请人:', inviteeProfile)
    }
  }
}

testInvitationReward().catch(console.error)
