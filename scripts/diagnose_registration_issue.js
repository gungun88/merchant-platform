// 诊断注册流程问题 - 为什么有些用户只有 auth 记录而没有 profile
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

async function diagnose() {
  console.log('\n' + '='.repeat(60))
  console.log('注册流程诊断报告')
  console.log('='.repeat(60))

  // 1. 检查触发器状态
  console.log('\n【1】触发器状态检查\n')

  const testEmail = `trigger_test_${Date.now()}@example.com`
  const { data: testUser, error: testError } = await supabase.auth.admin.createUser({
    email: testEmail,
    password: 'Test123!@#',
    email_confirm: true
  })

  if (testError) {
    console.log('❌ 无法创建测试用户:', testError.message)
    return
  }

  console.log('✅ 测试用户创建成功:', testUser.user.id)

  // 等待触发器执行
  await new Promise(resolve => setTimeout(resolve, 2000))

  const { data: testProfile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', testUser.user.id)
    .maybeSingle()

  if (testProfile) {
    console.log('✅ 触发器正常工作 - Profile 自动创建成功')
    console.log('   用户名:', testProfile.username)
    console.log('   邀请码:', testProfile.invitation_code)
    console.log('   积分:', testProfile.points)
  } else {
    console.log('❌ 触发器未工作 - Profile 没有自动创建')
    console.log('   这就是问题所在!')
  }

  // 清理测试用户
  await supabase.auth.admin.deleteUser(testUser.user.id)
  if (testProfile) {
    await supabase.from('profiles').delete().eq('id', testUser.user.id)
  }
  console.log('   测试用户已清理')

  // 2. 检查孤儿用户 (有 auth 但没有 profile)
  console.log('\n【2】孤儿用户检查 (有auth记录但无profile)\n')

  const { data: allAuthUsers } = await supabase.auth.admin.listUsers()
  const { data: allProfiles } = await supabase
    .from('profiles')
    .select('id')

  const profileIds = new Set(allProfiles?.map(p => p.id) || [])
  const orphanUsers = allAuthUsers?.users?.filter(u => !profileIds.has(u.id)) || []

  if (orphanUsers.length > 0) {
    console.log(`❌ 发现 ${orphanUsers.length} 个孤儿用户:`)
    orphanUsers.slice(0, 10).forEach((user, i) => {
      console.log(`   ${i + 1}. ${user.email}`)
      console.log(`      ID: ${user.id}`)
      console.log(`      注册时间: ${user.created_at}`)
      console.log(`      最后登录: ${user.last_sign_in_at || '从未登录'}`)
    })
    if (orphanUsers.length > 10) {
      console.log(`   ... 还有 ${orphanUsers.length - 10} 个`)
    }
  } else {
    console.log('✅ 没有发现孤儿用户')
  }

  // 3. 检查注册流程代码
  console.log('\n【3】注册流程分析\n')

  console.log('前端注册流程 (app/auth/register/page.tsx):')
  console.log('   ├─ 使用 supabase.auth.signUp() 创建用户')
  console.log('   ├─ 依赖数据库触发器自动创建 profile')
  console.log('   └─ 不会手动创建 profile 记录')

  console.log('\n数据库触发器历史:')
  console.log('   ├─ 058_disable_trigger_temporary.sql - 触发器被禁用')
  console.log('   ├─ 061_final_fix_user_trigger.sql - 触发器被重新启用')
  console.log('   └─ 当前状态: ' + (testProfile ? '已启用' : '已禁用'))

  // 4. 问题根因分析
  console.log('\n【4】问题根因分析\n')

  if (!testProfile) {
    console.log('❌ 核心问题: 数据库触发器未启用或失效')
    console.log('')
    console.log('可能原因:')
    console.log('   1. 触发器在数据库中被禁用 (最可能)')
    console.log('   2. 触发器函数执行失败但没有抛出错误')
    console.log('   3. 触发器权限不足')
    console.log('')
    console.log('影响:')
    console.log(`   - ${orphanUsers.length} 个用户受影响`)
    console.log('   - 这些用户无法在管理后台搜索到')
    console.log('   - 这些用户没有积分、邀请码等数据')
  } else {
    console.log('✅ 触发器当前工作正常')
    console.log('')
    console.log('孤儿用户的产生原因:')
    console.log('   - 在触发器被禁用期间注册的用户')
    console.log('   - 时间段: 058号迁移到061号迁移之间')
  }

  // 5. 解决方案
  console.log('\n【5】解决方案\n')

  console.log('方案A: 重新启用触发器 (推荐)')
  console.log('   1. 在 Supabase Dashboard 执行: scripts/061_final_fix_user_trigger.sql')
  console.log('   2. 验证触发器是否正常工作')
  console.log('   3. 为现有孤儿用户补充 profile 数据')
  console.log('')
  console.log('方案B: 应用层创建 profile')
  console.log('   1. 修改前端注册代码,手动创建 profile')
  console.log('   2. 需要修改 app/auth/register/page.tsx')
  console.log('   3. 增加代码复杂度,不推荐')

  // 6. 修复孤儿用户的脚本
  if (orphanUsers.length > 0) {
    console.log('\n【6】修复现有孤儿用户\n')
    console.log('可以运行以下脚本为孤儿用户创建 profile:')
    console.log('   node scripts/fix_orphan_users.js')
  }

  // 7. 预防措施
  console.log('\n【7】预防措施\n')
  console.log('✓ 定期监控 auth.users 和 profiles 表的一致性')
  console.log('✓ 在生产环境修改触发器前先在测试环境验证')
  console.log('✓ 触发器修改后立即执行测试脚本验证')
  console.log('✓ 考虑添加数据库层面的监控告警')

  console.log('\n' + '='.repeat(60))
  console.log('诊断完成')
  console.log('='.repeat(60))
}

diagnose().catch(console.error)
