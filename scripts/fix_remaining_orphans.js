// 修复剩余的3个用户名重复的孤儿用户
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

function generateInvitationCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

async function fixRemainingOrphans() {
  console.log('\n修复剩余的孤儿用户...\n')

  const failedUsers = [
    { email: '1158563767@qq.com', id: 'fb10e009-e350-4596-9a4e-ae2da0449699' },
    { email: 'shuer0917@gmail.com', id: 'e9de1bca-2cb0-4839-bd4c-77329840dacb' },
    { email: 'joseallen483@outlook.com', id: '152c16f0-462e-47b5-9fdf-e6c1f3faaec3' }
  ]

  // 获取最大用户编号
  const { data: maxUserNumber } = await supabase
    .from('profiles')
    .select('user_number')
    .order('user_number', { ascending: false })
    .limit(1)
    .maybeSingle()

  let nextUserNumber = maxUserNumber?.user_number ? maxUserNumber.user_number + 1 : 1252

  for (const user of failedUsers) {
    console.log(`处理: ${user.email}`)

    // 获取 auth 用户信息
    const { data: authUsers } = await supabase.auth.admin.listUsers()
    const authUser = authUsers?.users?.find(u => u.id === user.id)

    if (!authUser) {
      console.log('   ❌ auth用户不存在')
      continue
    }

    // 生成唯一用户名
    let baseUsername = authUser.email?.split('@')[0] || `user${nextUserNumber}`
    let username = baseUsername
    let suffix = 1

    // 检查用户名是否已存在
    let { data: existing } = await supabase
      .from('profiles')
      .select('username')
      .eq('username', username)
      .maybeSingle()

    while (existing) {
      username = `${baseUsername}_${suffix}`
      const result = await supabase
        .from('profiles')
        .select('username')
        .eq('username', username)
        .maybeSingle()
      existing = result.data
      suffix++
    }

    // 生成唯一邀请码
    let invitationCode = generateInvitationCode()
    let attempts = 0
    let { data: existingCode } = await supabase
      .from('profiles')
      .select('invitation_code')
      .eq('invitation_code', invitationCode)
      .maybeSingle()

    while (existingCode && attempts < 10) {
      invitationCode = generateInvitationCode()
      const result = await supabase
        .from('profiles')
        .select('invitation_code')
        .eq('invitation_code', invitationCode)
        .maybeSingle()
      existingCode = result.data
      attempts++
    }

    try {
      const { error } = await supabase
        .from('profiles')
        .insert({
          id: authUser.id,
          username: username,
          user_number: nextUserNumber,
          invitation_code: invitationCode,
          email: authUser.email,
          points: 0,
          role: 'user',
          created_at: authUser.created_at
        })

      if (error) throw error

      console.log(`   ✅ 成功 (用户名: ${username}, 用户编号: ${nextUserNumber}, 邀请码: ${invitationCode})`)
      nextUserNumber++
    } catch (error) {
      console.log(`   ❌ 失败: ${error.message}`)
    }
  }

  console.log('\n验证结果...')
  const { data: allAuthUsers } = await supabase.auth.admin.listUsers()
  const { data: allProfiles } = await supabase.from('profiles').select('id')

  const profileIds = new Set(allProfiles?.map(p => p.id) || [])
  const orphans = allAuthUsers?.users?.filter(u => !profileIds.has(u.id)) || []

  if (orphans.length === 0) {
    console.log('✅ 所有孤儿用户已修复!')
  } else {
    console.log(`⚠️  还有 ${orphans.length} 个孤儿用户`)
    orphans.forEach(u => console.log(`   - ${u.email}`))
  }
}

fixRemainingOrphans().catch(console.error)
