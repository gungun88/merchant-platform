/**
 * 检查新用户注册问题
 * 查看哪些用户缺少用户编号和积分
 */

const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

// 读取 .env.local 文件
let supabaseUrl, supabaseServiceKey

try {
  const envPath = path.join(__dirname, '..', '.env.local')
  const envContent = fs.readFileSync(envPath, 'utf-8')

  envContent.split('\n').forEach(line => {
    const match = line.match(/^NEXT_PUBLIC_SUPABASE_URL=(.+)$/)
    if (match) supabaseUrl = match[1].trim()

    const match2 = line.match(/^SUPABASE_SERVICE_ROLE_KEY=(.+)$/)
    if (match2) supabaseServiceKey = match2[1].trim()
  })
} catch (err) {
  console.error('❌ 无法读取 .env.local 文件:', err.message)
  process.exit(1)
}

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ 错误: 缺少 Supabase 配置')
  console.error('需要 SUPABASE_SERVICE_ROLE_KEY (服务端密钥)')
  process.exit(1)
}

// 使用 service role key 来绕过 RLS
const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function checkUsers() {
  console.log('🔍 检查用户数据问题...\n')

  try {
    // 获取所有用户
    const { data: users, error } = await supabase
      .from('profiles')
      .select('id, username, user_number, points, role, created_at')
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) {
      console.error('❌ 查询失败:', error.message)
      return
    }

    console.log(`📊 最近 ${users.length} 个用户:\n`)

    let problemCount = 0
    let okCount = 0

    users.forEach((user, index) => {
      const hasUserNumber = user.user_number !== null
      const hasPoints = user.points !== null && user.points > 0
      const hasRole = user.role !== null

      const status = (hasUserNumber && hasPoints && hasRole) ? '✅' : '❌'

      if (!hasUserNumber || !hasPoints || !hasRole) {
        problemCount++
        console.log(`${status} [${index + 1}] ${user.username}`)
        console.log(`   ID: ${user.id}`)
        console.log(`   用户编号: ${user.user_number || '❌ 缺失'}`)
        console.log(`   积分: ${user.points ?? '❌ 缺失'}`)
        console.log(`   角色: ${user.role || '❌ 缺失'}`)
        console.log(`   注册时间: ${new Date(user.created_at).toLocaleString('zh-CN')}`)
        console.log('')
      } else {
        okCount++
      }
    })

    console.log('=' .repeat(60))
    console.log('📊 统计结果:')
    console.log('=' .repeat(60))
    console.log(`✅ 正常用户: ${okCount}`)
    console.log(`❌ 有问题的用户: ${problemCount}`)
    console.log('')

    if (problemCount > 0) {
      console.log('🔧 需要修复!')
      console.log('')
      console.log('请在 Supabase Dashboard → SQL Editor 中执行:')
      console.log('   scripts/999_fix_new_user_registration.sql')
      console.log('')
      console.log('该脚本会:')
      console.log('  1. ✅ 重建用户注册触发器')
      console.log('  2. ✅ 自动修复所有有问题的用户')
      console.log('  3. ✅ 补发缺失的积分和用户编号')
      console.log('  4. ✅ 验证修复结果')
    } else {
      console.log('✅ 所有用户数据正常!')
    }

  } catch (err) {
    console.error('❌ 检查失败:', err.message)
  }
}

// 检查触发器状态
async function checkTriggers() {
  console.log('\n🔍 检查数据库触发器...\n')

  try {
    // 这需要使用原始 SQL 查询
    const { data, error } = await supabase.rpc('exec_sql', {
      query: `
        SELECT trigger_name, event_object_table, action_timing, event_manipulation
        FROM information_schema.triggers
        WHERE trigger_schema = 'public'
          AND trigger_name IN ('on_auth_user_created', 'assign_user_number_on_insert')
        ORDER BY trigger_name
      `
    })

    if (error) {
      console.log('⚠️  无法检查触发器状态 (需要自定义函数)')
      console.log('   请在 Supabase Dashboard 中手动检查')
    } else {
      console.log('触发器状态:', data)
    }
  } catch (err) {
    // 忽略错误
  }
}

// 运行检查
checkUsers().then(() => {
  console.log('\n提示: 修复完成后,重新运行此脚本验证\n')
})
