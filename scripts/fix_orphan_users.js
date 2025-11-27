// 批量修复孤儿用户 (有auth记录但无profile的用户)
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

// 生成邀请码
function generateInvitationCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

async function fixOrphanUsers() {
  console.log('\n' + '='.repeat(60))
  console.log('批量修复孤儿用户')
  console.log('='.repeat(60))

  // 1. 查找所有孤儿用户
  console.log('\n步骤1: 查找孤儿用户...')

  const { data: allAuthUsers } = await supabase.auth.admin.listUsers()
  const { data: allProfiles } = await supabase
    .from('profiles')
    .select('id')

  const profileIds = new Set(allProfiles?.map(p => p.id) || [])
  const orphanUsers = allAuthUsers?.users?.filter(u => !profileIds.has(u.id)) || []

  console.log(`发现 ${orphanUsers.length} 个孤儿用户`)

  if (orphanUsers.length === 0) {
    console.log('✅ 没有需要修复的用户')
    return
  }

  // 2. 获取最大用户编号
  const { data: maxUserNumber } = await supabase
    .from('profiles')
    .select('user_number')
    .order('user_number', { ascending: false })
    .limit(1)
    .maybeSingle()

  let nextUserNumber = maxUserNumber?.user_number ? maxUserNumber.user_number + 1 : 100001

  console.log(`\n步骤2: 开始修复 (起始用户编号: ${nextUserNumber})...\n`)

  let successCount = 0
  let failCount = 0
  const failures = []

  for (const authUser of orphanUsers) {
    try {
      console.log(`处理: ${authUser.email}`)

      // 生成唯一邀请码
      let invitationCode = generateInvitationCode()
      let attempts = 0
      let { data: existing } = await supabase
        .from('profiles')
        .select('invitation_code')
        .eq('invitation_code', invitationCode)
        .maybeSingle()

      while (existing && attempts < 10) {
        invitationCode = generateInvitationCode()
        const result = await supabase
          .from('profiles')
          .select('invitation_code')
          .eq('invitation_code', invitationCode)
          .maybeSingle()
        existing = result.data
        attempts++
      }

      // 创建 profile
      const { error: insertError } = await supabase
        .from('profiles')
        .insert({
          id: authUser.id,
          username: authUser.user_metadata?.username || authUser.email?.split('@')[0] || `user${nextUserNumber}`,
          user_number: nextUserNumber,
          invitation_code: invitationCode,
          email: authUser.email,
          points: 0, // 历史用户不给积分,避免不公平
          role: 'user',
          created_at: authUser.created_at
        })

      if (insertError) {
        throw insertError
      }

      console.log(`   ✅ Profile创建成功 (用户编号: ${nextUserNumber}, 邀请码: ${invitationCode})`)
      successCount++
      nextUserNumber++

    } catch (error) {
      console.log(`   ❌ 失败: ${error.message}`)
      failCount++
      failures.push({
        email: authUser.email,
        id: authUser.id,
        error: error.message
      })
    }
  }

  // 3. 统计结果
  console.log('\n' + '='.repeat(60))
  console.log('修复完成')
  console.log('='.repeat(60))
  console.log(`总计: ${orphanUsers.length} 个用户`)
  console.log(`成功: ${successCount} 个`)
  console.log(`失败: ${failCount} 个`)

  if (failures.length > 0) {
    console.log('\n失败的用户:')
    failures.forEach((f, i) => {
      console.log(`${i + 1}. ${f.email} (${f.id})`)
      console.log(`   错误: ${f.error}`)
    })
  }

  // 4. 验证修复结果
  console.log('\n步骤3: 验证修复结果...')
  const { data: verifyAuthUsers } = await supabase.auth.admin.listUsers()
  const { data: verifyProfiles } = await supabase
    .from('profiles')
    .select('id')

  const verifyProfileIds = new Set(verifyProfiles?.map(p => p.id) || [])
  const remainingOrphans = verifyAuthUsers?.users?.filter(u => !verifyProfileIds.has(u.id)) || []

  if (remainingOrphans.length === 0) {
    console.log('✅ 所有用户已修复,没有遗留孤儿用户')
  } else {
    console.log(`⚠️  还有 ${remainingOrphans.length} 个孤儿用户未修复`)
  }

  console.log('\n注意事项:')
  console.log('1. 这些历史孤儿用户的初始积分设置为0')
  console.log('2. 如需给他们补发积分,请手动处理')
  console.log('3. 现在他们应该可以在管理后台搜索到了')
}

fixOrphanUsers().catch(console.error)
