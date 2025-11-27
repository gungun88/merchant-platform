// 修复 2247513382@qq.com 用户的 profile 记录
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

async function fixUser() {
  const email = '2247513382@qq.com'
  const userId = '353373eb-33f0-4351-abe4-71c9609e4dc7'

  console.log(`\n=== 修复用户 ${email} 的 profile 记录 ===\n`)

  // 1. 验证用户存在
  const { data: authUsers } = await supabase.auth.admin.listUsers()
  const authUser = authUsers?.users?.find(u => u.id === userId)

  if (!authUser) {
    console.error('❌ 用户不存在')
    return
  }

  console.log('✅ 确认用户存在于 auth.users')

  // 2. 检查 profile 是否已存在
  const { data: existingProfile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle()

  if (existingProfile) {
    console.log('⚠️ Profile 已存在,无需创建')
    console.log(existingProfile)
    return
  }

  // 3. 生成用户编号
  console.log('\n生成用户编号...')
  const { data: maxUserNumber } = await supabase
    .from('profiles')
    .select('user_number')
    .order('user_number', { ascending: false })
    .limit(1)
    .maybeSingle()

  const nextUserNumber = maxUserNumber?.user_number ? maxUserNumber.user_number + 1 : 100001

  // 4. 生成邀请码
  function generateInvitationCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    let code = ''
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return code
  }

  let invitationCode = generateInvitationCode()

  // 确保邀请码唯一
  let { data: existing } = await supabase
    .from('profiles')
    .select('invitation_code')
    .eq('invitation_code', invitationCode)
    .maybeSingle()

  while (existing) {
    invitationCode = generateInvitationCode()
    const result = await supabase
      .from('profiles')
      .select('invitation_code')
      .eq('invitation_code', invitationCode)
      .maybeSingle()
    existing = result.data
  }

  // 5. 创建 profile 记录
  console.log('\n创建 profile 记录...')
  console.log(`  用户编号: ${nextUserNumber}`)
  console.log(`  邀请码: ${invitationCode}`)

  const { data: newProfile, error: insertError } = await supabase
    .from('profiles')
    .insert({
      id: userId,
      username: authUser.email?.split('@')[0] || `user${nextUserNumber}`,
      user_number: nextUserNumber,
      invitation_code: invitationCode,
      points: 0,
      role: 'user',
      created_at: authUser.created_at
    })
    .select()
    .single()

  if (insertError) {
    console.error('❌ 创建 profile 失败:', insertError)
    return
  }

  console.log('✅ Profile 创建成功!')

  // 6. 验证结果
  console.log('\n验证创建结果...')
  const { data: verifyProfile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()

  if (verifyProfile) {
    console.log('✅ 验证成功! Profile 数据:')
    console.log(verifyProfile)
  }

  console.log('\n' + '='.repeat(50))
  console.log('修复完成!')
  console.log('='.repeat(50))
  console.log('现在该用户应该可以在管理后台搜索到了')
}

fixUser().catch(console.error)
