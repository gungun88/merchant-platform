/**
 * 删除用户账户脚本（销号）
 *
 * 用途：
 * - 完整删除用户及其所有相关数据
 * - 包括：auth用户、profile、积分记录、通知、邀请记录、商家信息等
 *
 * 使用方法：
 * node scripts/delete_user_account.js <email>
 *
 * 示例：
 * node scripts/delete_user_account.js user@example.com
 *
 * 注意：
 * - 此操作不可逆，请谨慎使用
 * - 建议在删除前先备份数据
 */

const { createClient } = require('@supabase/supabase-js')
const readline = require('readline')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ 缺少环境变量:')
  console.error('   NEXT_PUBLIC_SUPABASE_URL')
  console.error('   SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

// 创建命令行输入接口
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

// 封装 readline 为 Promise
function question(query) {
  return new Promise(resolve => rl.question(query, resolve))
}

/**
 * 查找用户信息
 */
async function findUser(email) {
  console.log(`\n🔍 正在查找用户: ${email}\n`)

  // 从 auth.users 查找用户
  const { data: authData } = await supabase.auth.admin.listUsers()
  const authUser = authData.users.find(u => u.email === email)

  if (!authUser) {
    console.log('❌ 未找到该邮箱对应的用户')
    return null
  }

  console.log('✅ 找到用户:')
  console.log(`   ID: ${authUser.id}`)
  console.log(`   邮箱: ${authUser.email}`)
  console.log(`   注册时间: ${authUser.created_at}`)

  // 获取 profile 信息
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', authUser.id)
    .maybeSingle()

  if (profile) {
    console.log(`   用户名: ${profile.username}`)
    console.log(`   积分: ${profile.points}`)
    console.log(`   角色: ${profile.role}`)
    console.log(`   是否商家: ${profile.is_merchant ? '是' : '否'}`)
  }

  return { authUser, profile }
}

/**
 * 统计用户相关数据
 */
async function countUserData(userId) {
  console.log('\n📊 统计用户相关数据:\n')

  // 统计各类数据
  const stats = {}

  // 积分记录
  const { count: pointTransCount } = await supabase
    .from('point_transactions')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
  stats.pointTransactions = pointTransCount || 0

  // 旧积分记录
  const { count: pointsLogCount } = await supabase
    .from('points_log')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
  stats.pointsLog = pointsLogCount || 0

  // 通知
  const { count: notificationsCount } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
  stats.notifications = notificationsCount || 0

  // 邀请记录（作为邀请人）
  const { count: inviterCount } = await supabase
    .from('invitations')
    .select('*', { count: 'exact', head: true })
    .eq('inviter_id', userId)
  stats.asInviter = inviterCount || 0

  // 邀请记录（作为被邀请人）
  const { count: inviteeCount } = await supabase
    .from('invitations')
    .select('*', { count: 'exact', head: true })
    .eq('invitee_id', userId)
  stats.asInvitee = inviteeCount || 0

  // 商家信息
  const { count: merchantsCount } = await supabase
    .from('merchants')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
  stats.merchants = merchantsCount || 0

  // 收藏记录
  const { count: favoritesCount } = await supabase
    .from('favorites')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
  stats.favorites = favoritesCount || 0

  // 签到记录
  const { count: checkinsCount } = await supabase
    .from('checkins')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
  stats.checkins = checkinsCount || 0

  // 查看联系方式记录
  const { count: viewsCount } = await supabase
    .from('contact_views')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
  stats.contactViews = viewsCount || 0

  // 押金商家申请
  const { count: depositAppsCount } = await supabase
    .from('deposit_merchant_applications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
  stats.depositApplications = depositAppsCount || 0

  // 押金商家记录
  const { count: depositMerchantCount } = await supabase
    .from('deposit_merchants')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
  stats.depositMerchants = depositMerchantCount || 0

  // 管理员日志
  const { count: adminLogsCount } = await supabase
    .from('admin_logs')
    .select('*', { count: 'exact', head: true })
    .eq('admin_id', userId)
  stats.adminLogs = adminLogsCount || 0

  // 内测码使用记录
  const { count: betaUsageCount } = await supabase
    .from('beta_code_usages')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
  stats.betaCodeUsages = betaUsageCount || 0

  // 打印统计结果
  console.log(`   积分交易记录 (point_transactions): ${stats.pointTransactions}`)
  console.log(`   旧积分记录 (points_log): ${stats.pointsLog}`)
  console.log(`   通知 (notifications): ${stats.notifications}`)
  console.log(`   作为邀请人 (invitations): ${stats.asInviter}`)
  console.log(`   作为被邀请人 (invitations): ${stats.asInvitee}`)
  console.log(`   商家信息 (merchants): ${stats.merchants}`)
  console.log(`   收藏记录 (favorites): ${stats.favorites}`)
  console.log(`   签到记录 (checkins): ${stats.checkins}`)
  console.log(`   查看联系方式 (contact_views): ${stats.contactViews}`)
  console.log(`   押金商家申请 (deposit_applications): ${stats.depositApplications}`)
  console.log(`   押金商家记录 (deposit_merchants): ${stats.depositMerchants}`)
  console.log(`   管理员日志 (admin_logs): ${stats.adminLogs}`)
  console.log(`   内测码使用 (beta_code_usages): ${stats.betaCodeUsages}`)

  const total = Object.values(stats).reduce((sum, val) => sum + val, 0)
  console.log(`\n   📦 总计: ${total} 条相关数据`)

  return stats
}

/**
 * 删除用户及所有相关数据
 */
async function deleteUser(userId, email) {
  console.log('\n🗑️  开始删除用户数据...\n')

  let deletedCount = 0

  try {
    // 1. 删除积分交易记录
    console.log('   删除积分交易记录...')
    const { error: e1 } = await supabase
      .from('point_transactions')
      .delete()
      .eq('user_id', userId)
    if (e1) console.error('     ⚠️  错误:', e1.message)
    else { console.log('     ✅ 完成'); deletedCount++ }

    // 2. 删除旧积分记录
    console.log('   删除旧积分记录...')
    const { error: e2 } = await supabase
      .from('points_log')
      .delete()
      .eq('user_id', userId)
    if (e2) console.error('     ⚠️  错误:', e2.message)
    else { console.log('     ✅ 完成'); deletedCount++ }

    // 3. 删除通知
    console.log('   删除通知...')
    const { error: e3 } = await supabase
      .from('notifications')
      .delete()
      .eq('user_id', userId)
    if (e3) console.error('     ⚠️  错误:', e3.message)
    else { console.log('     ✅ 完成'); deletedCount++ }

    // 4. 删除邀请记录（作为邀请人）
    console.log('   删除邀请记录（作为邀请人）...')
    const { error: e4 } = await supabase
      .from('invitations')
      .delete()
      .eq('inviter_id', userId)
    if (e4) console.error('     ⚠️  错误:', e4.message)
    else { console.log('     ✅ 完成'); deletedCount++ }

    // 5. 删除邀请记录（作为被邀请人）
    console.log('   删除邀请记录（作为被邀请人）...')
    const { error: e5 } = await supabase
      .from('invitations')
      .delete()
      .eq('invitee_id', userId)
    if (e5) console.error('     ⚠️  错误:', e5.message)
    else { console.log('     ✅ 完成'); deletedCount++ }

    // 6. 删除收藏记录
    console.log('   删除收藏记录...')
    const { error: e6 } = await supabase
      .from('favorites')
      .delete()
      .eq('user_id', userId)
    if (e6) console.error('     ⚠️  错误:', e6.message)
    else { console.log('     ✅ 完成'); deletedCount++ }

    // 7. 删除签到记录
    console.log('   删除签到记录...')
    const { error: e7 } = await supabase
      .from('checkins')
      .delete()
      .eq('user_id', userId)
    if (e7) console.error('     ⚠️  错误:', e7.message)
    else { console.log('     ✅ 完成'); deletedCount++ }

    // 8. 删除查看联系方式记录
    console.log('   删除查看联系方式记录...')
    const { error: e8 } = await supabase
      .from('contact_views')
      .delete()
      .eq('user_id', userId)
    if (e8) console.error('     ⚠️  错误:', e8.message)
    else { console.log('     ✅ 完成'); deletedCount++ }

    // 9. 删除押金商家申请
    console.log('   删除押金商家申请...')
    const { error: e9 } = await supabase
      .from('deposit_merchant_applications')
      .delete()
      .eq('user_id', userId)
    if (e9) console.error('     ⚠️  错误:', e9.message)
    else { console.log('     ✅ 完成'); deletedCount++ }

    // 10. 删除押金商家记录
    console.log('   删除押金商家记录...')
    const { error: e10 } = await supabase
      .from('deposit_merchants')
      .delete()
      .eq('user_id', userId)
    if (e10) console.error('     ⚠️  错误:', e10.message)
    else { console.log('     ✅ 完成'); deletedCount++ }

    // 11. 删除管理员日志（如果是管理员）
    console.log('   删除管理员日志...')
    const { error: e11 } = await supabase
      .from('admin_logs')
      .delete()
      .eq('admin_id', userId)
    if (e11) console.error('     ⚠️  错误:', e11.message)
    else { console.log('     ✅ 完成'); deletedCount++ }

    // 12. 删除内测码使用记录
    console.log('   删除内测码使用记录...')
    const { error: e12 } = await supabase
      .from('beta_code_usages')
      .delete()
      .eq('user_id', userId)
    if (e12) console.error('     ⚠️  错误:', e12.message)
    else { console.log('     ✅ 完成'); deletedCount++ }

    // 13. 删除商家信息（会级联删除相关评论等）
    console.log('   删除商家信息...')
    const { error: e13 } = await supabase
      .from('merchants')
      .delete()
      .eq('user_id', userId)
    if (e13) console.error('     ⚠️  错误:', e13.message)
    else { console.log('     ✅ 完成'); deletedCount++ }

    // 14. 删除 profile（会触发级联删除）
    console.log('   删除用户 profile...')
    const { error: e14 } = await supabase
      .from('profiles')
      .delete()
      .eq('id', userId)
    if (e14) console.error('     ⚠️  错误:', e14.message)
    else { console.log('     ✅ 完成'); deletedCount++ }

    // 15. 最后删除 auth 用户
    console.log('   删除 auth 用户...')
    const { error: e15 } = await supabase.auth.admin.deleteUser(userId)
    if (e15) console.error('     ⚠️  错误:', e15.message)
    else { console.log('     ✅ 完成'); deletedCount++ }

    console.log(`\n✅ 删除完成! 共处理 ${deletedCount} 个操作`)
    console.log(`\n🎉 用户 ${email} 已成功删除`)

    return true
  } catch (error) {
    console.error('\n❌ 删除过程中发生错误:', error)
    return false
  }
}

/**
 * 主函数
 */
async function main() {
  console.log('╔═══════════════════════════════════════════════════╗')
  console.log('║          用户账户删除脚本 (销号工具)              ║')
  console.log('╚═══════════════════════════════════════════════════╝')

  // 获取命令行参数
  const email = process.argv[2]

  if (!email) {
    console.log('\n❌ 请提供要删除的用户邮箱')
    console.log('\n使用方法:')
    console.log('   node scripts/delete_user_account.js <email>')
    console.log('\n示例:')
    console.log('   node scripts/delete_user_account.js user@example.com')
    process.exit(1)
  }

  // 查找用户
  const userData = await findUser(email)
  if (!userData) {
    rl.close()
    process.exit(1)
  }

  const { authUser, profile } = userData
  const userId = authUser.id

  // 统计用户数据
  await countUserData(userId)

  // 确认删除
  console.log('\n⚠️  警告: 此操作不可逆!')
  console.log('   删除后将无法恢复用户数据')
  console.log('   建议在删除前先备份数据\n')

  const confirm1 = await question(`确认要删除用户 ${email} 吗? (yes/no): `)

  if (confirm1.toLowerCase() !== 'yes') {
    console.log('\n❌ 已取消删除操作')
    rl.close()
    process.exit(0)
  }

  // 二次确认
  const confirm2 = await question(`\n请再次输入用户邮箱以确认删除: `)

  if (confirm2 !== email) {
    console.log('\n❌ 邮箱不匹配，已取消删除操作')
    rl.close()
    process.exit(0)
  }

  // 执行删除
  const success = await deleteUser(userId, email)

  rl.close()

  if (success) {
    console.log('\n✨ 操作成功完成')
    process.exit(0)
  } else {
    console.log('\n❌ 操作失败，请检查错误信息')
    process.exit(1)
  }
}

// 执行主函数
main().catch(error => {
  console.error('❌ 执行失败:', error)
  rl.close()
  process.exit(1)
})
