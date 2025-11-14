// 测试 Supabase Realtime 是否正常工作
const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

// 读取 .env.local 文件
const envPath = path.join(__dirname, '..', '.env.local')
const envContent = fs.readFileSync(envPath, 'utf-8')
const envVars = {}
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/)
  if (match) {
    envVars[match[1].trim()] = match[2].trim()
  }
})

const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = envVars.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ 缺少 Supabase 环境变量')
  process.exit(1)
}

console.log('🔍 测试 Supabase Realtime 连接...')
console.log('📍 URL:', supabaseUrl)

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
})

console.log('✅ Supabase 客户端已创建')

// 测试订阅押金申请表
console.log('🔌 开始订阅 deposit_merchant_applications 表...')

const channel = supabase
  .channel('test-deposit-applications')
  .on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'deposit_merchant_applications',
    },
    (payload) => {
      console.log('✅ 收到数据变化:', payload)
    }
  )
  .subscribe((status, err) => {
    console.log('📡 订阅状态:', status)
    if (err) {
      console.error('❌ 订阅错误:', err)
    }
    if (status === 'SUBSCRIBED') {
      console.log('✅✅✅ 订阅成功！Realtime 正常工作！')
      console.log('现在你可以在数据库中插入/更新数据来测试...')
      console.log('按 Ctrl+C 退出')
    } else if (status === 'CHANNEL_ERROR') {
      console.error('❌ 通道错误 - 可能是表没有启用 Realtime')
      console.log('请在 Supabase Dashboard 的 Database > Replication 中启用表的 Realtime')
      process.exit(1)
    } else if (status === 'TIMED_OUT') {
      console.error('❌ 订阅超时')
      process.exit(1)
    } else if (status === 'CLOSED') {
      console.log('🔌 连接已关闭')
      process.exit(0)
    }
  })

// 保持脚本运行
process.on('SIGINT', () => {
  console.log('\n🔌 正在关闭订阅...')
  supabase.removeChannel(channel)
  process.exit(0)
})
