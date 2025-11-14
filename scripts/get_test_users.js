// 查询系统中的用户（用于测试）
// 用法: node scripts/get_test_users.js

const fs = require('fs')
const path = require('path')
const { createClient } = require('@supabase/supabase-js')

// 读取 .env.local 文件
function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env.local')
  const envContent = fs.readFileSync(envPath, 'utf8')
  const env = {}

  envContent.split('\n').forEach(line => {
    const trimmedLine = line.trim()
    if (trimmedLine && !trimmedLine.startsWith('#')) {
      const [key, ...valueParts] = trimmedLine.split('=')
      if (key && valueParts.length > 0) {
        env[key.trim()] = valueParts.join('=').trim()
      }
    }
  })

  return env
}

const env = loadEnv()
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ 缺少必要的环境变量')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function getTestUsers() {
  console.log('🔍 查询系统中的用户...\n')

  const { data: users, error } = await supabase
    .from('profiles')
    .select('id, email, username, points, role')
    .order('created_at', { ascending: false })
    .limit(10)

  if (error) {
    console.error('❌ 查询失败:', error.message)
    process.exit(1)
  }

  if (!users || users.length === 0) {
    console.log('⚠️  系统中还没有用户')
    console.log('请先在商家平台注册一个用户账户')
    process.exit(1)
  }

  console.log(`✅ 找到 ${users.length} 个用户:\n`)

  users.forEach((user, index) => {
    console.log(`${index + 1}. ${user.email || '无邮箱'}`)
    console.log(`   用户名: ${user.username}`)
    console.log(`   积分: ${user.points}`)
    console.log(`   角色: ${user.role}`)
    console.log('')
  })

  console.log('📝 测试建议:')
  console.log(`使用邮箱: ${users[0].email || '请先设置邮箱'}`)
  console.log(`当前积分: ${users[0].points}`)
  console.log('\n💡 提示: 如果用户没有邮箱，请在 profiles 表中手动添加')
}

getTestUsers()
