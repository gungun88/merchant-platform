/**
 * 测试使用客户端权限(anon key)查询退还申请数据
 */

const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

// 读取 .env.local 文件
const envPath = path.join(__dirname, '..', '.env.local')
const envContent = fs.readFileSync(envPath, 'utf-8')

// 解析环境变量
const envVars = {}
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/)
  if (match) {
    envVars[match[1].trim()] = match[2].trim()
  }
})

const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = envVars.NEXT_PUBLIC_SUPABASE_ANON_KEY

console.log('🔍 Testing deposit_refund_applications with anon key (client-side permissions)...\n')

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function testQuery() {
  try {
    // Test the same query that the frontend uses
    const { data, error, count } = await supabase
      .from('deposit_refund_applications')
      .select('*, merchants!inner(name, user_id, logo)', { count: 'exact' })
      .eq('application_status', 'pending')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('❌ Error with anon key:', error)
      console.log('\n这说明RLS策略阻止了匿名访问')
      console.log('需要用户登录后才能访问此数据\n')
      return
    }

    console.log('✅ Query succeeded with anon key')
    console.log('Count:', count)
    console.log('Data length:', data?.length || 0)

    if (data && data.length > 0) {
      console.log('\nFirst record:')
      console.log(JSON.stringify(data[0], null, 2))
    } else {
      console.log('\n⚠️ 查询成功但没有返回数据')
      console.log('可能原因:')
      console.log('1. RLS策略要求用户必须登录')
      console.log('2. RLS策略限制了用户只能看到自己的数据')
      console.log('3. 数据确实不存在\n')
    }

  } catch (error) {
    console.error('❌ Error:', error)
  }
}

testQuery()
