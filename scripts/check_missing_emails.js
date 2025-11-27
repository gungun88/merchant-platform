/**
 * 检查缺失邮箱的用户
 *
 * 此脚本用于诊断为什么某些用户在管理后台看不到邮箱
 *
 * 使用方法:
 * node scripts/check_missing_emails.js
 */

const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

// 读取 .env.local 文件
const envPath = path.join(__dirname, '..', '.env.local')
let supabaseUrl, supabaseServiceKey

try {
  const envContent = fs.readFileSync(envPath, 'utf-8')
  const lines = envContent.split('\n')
  lines.forEach(line => {
    const [key, value] = line.split('=')
    if (key && value) {
      const trimmedKey = key.trim()
      const trimmedValue = value.trim().replace(/^["']|["']$/g, '')
      if (trimmedKey === 'NEXT_PUBLIC_SUPABASE_URL') {
        supabaseUrl = trimmedValue
      } else if (trimmedKey === 'SUPABASE_SERVICE_ROLE_KEY') {
        supabaseServiceKey = trimmedValue
      }
    }
  })
} catch (error) {
  console.error('❌ 无法读取 .env.local 文件:', error.message)
}

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ 错误: 缺少必要的环境变量')
  console.error('   请确保 .env.local 文件中包含:')
  console.error('   - NEXT_PUBLIC_SUPABASE_URL')
  console.error('   - SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function checkMissingEmails() {
  try {
    console.log('🔍 开始检查用户邮箱...\n')

    // 1. 从 profiles 表获取所有用户
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, user_number, username, created_at')
      .order('created_at', { ascending: false })

    if (profilesError) {
      throw new Error(`获取 profiles 失败: ${profilesError.message}`)
    }

    console.log(`📊 Profiles 表总用户数: ${profiles.length}`)

    // 2. 从 auth.users 获取所有用户邮箱 (分页获取)
    let allUsers = []
    let page = 1
    const perPage = 1000
    let hasMore = true

    console.log('🔄 正在获取所有 auth.users 数据...')

    while (hasMore) {
      const { data: { users }, error: authError } = await supabase.auth.admin.listUsers({
        page,
        perPage
      })

      if (authError) {
        throw new Error(`获取 auth.users 失败: ${authError.message}`)
      }

      allUsers = allUsers.concat(users)
      hasMore = users.length === perPage
      page++

      if (users.length > 0) {
        console.log(`   - 第 ${page - 1} 页: ${users.length} 个用户`)
      }
    }

    console.log(`📊 Auth.users 表总用户数: ${allUsers.length}\n`)
    const users = allUsers

    // 3. 创建邮箱映射
    const emailMap = new Map()
    users.forEach(user => {
      if (user.email) {
        emailMap.set(user.id, user.email)
      }
    })

    console.log(`📧 有邮箱的用户数: ${emailMap.size}\n`)

    // 4. 找出缺失邮箱的用户
    const missingEmailUsers = []
    profiles.forEach(profile => {
      const email = emailMap.get(profile.id)
      if (!email) {
        missingEmailUsers.push({
          ...profile,
          email: null
        })
      }
    })

    // 5. 输出结果
    console.log(`\n📝 检查结果:`)
    console.log(`   ✅ 有邮箱的用户: ${profiles.length - missingEmailUsers.length}`)
    console.log(`   ❌ 缺失邮箱的用户: ${missingEmailUsers.length}\n`)

    if (missingEmailUsers.length > 0) {
      console.log(`⚠️  缺失邮箱的用户列表:`)
      console.log(`${'='.repeat(80)}`)
      console.log(`用户编号 | 用户名 | 用户ID | 注册时间`)
      console.log(`${'-'.repeat(80)}`)

      missingEmailUsers.forEach(user => {
        const createdAt = new Date(user.created_at).toLocaleString('zh-CN')
        console.log(`NO.${user.user_number} | ${user.username} | ${user.id.substring(0, 8)}... | ${createdAt}`)
      })
      console.log(`${'='.repeat(80)}\n`)

      // 6. 检查这些用户在 auth.users 中的详细信息
      console.log(`🔍 检查这些用户在 auth.users 中的详细信息...\n`)

      for (const profile of missingEmailUsers.slice(0, 5)) { // 只检查前5个
        const authUser = users.find(u => u.id === profile.id)
        if (authUser) {
          console.log(`用户 NO.${profile.user_number} (${profile.username}):`)
          console.log(`  - ID: ${authUser.id}`)
          console.log(`  - Email: ${authUser.email || '(null)'}`)
          console.log(`  - Phone: ${authUser.phone || '(null)'}`)
          console.log(`  - Email Confirmed: ${authUser.email_confirmed_at ? '是' : '否'}`)
          console.log(`  - Created At: ${new Date(authUser.created_at).toLocaleString('zh-CN')}`)
          console.log(`  - Last Sign In: ${authUser.last_sign_in_at ? new Date(authUser.last_sign_in_at).toLocaleString('zh-CN') : '(无)'}\n`)
        } else {
          console.log(`用户 NO.${profile.user_number} (${profile.username}):`)
          console.log(`  ⚠️  在 auth.users 表中找不到此用户!\n`)
        }
      }

      if (missingEmailUsers.length > 5) {
        console.log(`   ... 还有 ${missingEmailUsers.length - 5} 个用户未显示\n`)
      }
    }

    // 7. 分析问题原因
    console.log(`\n💡 可能的原因:`)
    console.log(`   1. 用户使用第三方登录(Facebook/Google)时没有提供邮箱权限`)
    console.log(`   2. 用户使用手机号注册,没有绑定邮箱`)
    console.log(`   3. 早期版本的注册流程没有强制要求邮箱`)
    console.log(`   4. 用户数据迁移时邮箱信息丢失`)
    console.log(`   5. auth.users 表和 profiles 表数据不同步\n`)

    // 8. 提供解决方案
    console.log(`\n🔧 解决方案:`)
    console.log(`   方案1: 在 profiles 表中添加 email 字段,手动同步邮箱`)
    console.log(`   方案2: 要求这些用户重新登录并补充邮箱`)
    console.log(`   方案3: 修改代码,如果 auth.users 没有邮箱,则显示"未设置"`)
    console.log(`   方案4: 使用管理员工具批量为这些用户补充邮箱\n`)

    console.log(`✅ 检查完成!`)

  } catch (error) {
    console.error(`\n❌ 错误:`, error.message)
    process.exit(1)
  }
}

// 执行检查
checkMissingEmails()
