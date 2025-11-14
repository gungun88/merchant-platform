// 测试修改后的查询逻辑
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

const supabase = createClient(
  envVars.NEXT_PUBLIC_SUPABASE_URL,
  envVars.SUPABASE_SERVICE_ROLE_KEY
)

async function testQuery() {
  console.log('测试修改后的查询逻辑...\n')

  // 第一步：查询申请数据
  const { data, error, count } = await supabase
    .from("deposit_merchant_applications")
    .select("*, merchants!inner(name, user_id)", { count: "exact" })
    .eq("application_status", "pending")
    .order("created_at", { ascending: false })
    .range(0, 19)

  if (error) {
    console.error('❌ 第一步查询失败:', error)
    return
  }

  console.log(`✅ 第一步成功: 找到 ${count} 条记录`)

  if (!data || data.length === 0) {
    console.log('没有待审核的申请')
    return
  }

  console.log(`\n申请数据:`)
  data.forEach((app, i) => {
    console.log(`  ${i + 1}. merchant_id: ${app.merchant_id}, user_id: ${app.user_id}`)
  })

  // 第二步：获取所有用户ID
  const userIds = data.map((app) => app.user_id)
  console.log(`\n提取的用户IDs: ${userIds.join(', ')}`)

  // 第三步：查询用户资料
  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, username")
    .in("id", userIds)

  if (profilesError) {
    console.error('\n❌ 第二步查询profiles失败:', profilesError)
    return
  }

  console.log(`\n✅ 第二步成功: 找到 ${profiles?.length || 0} 个用户资料`)

  if (profiles && profiles.length > 0) {
    console.log(`\nProfiles数据:`)
    profiles.forEach((p, i) => {
      console.log(`  ${i + 1}. id: ${p.id}, username: ${p.username}, email: ${p.email}`)
    })
  } else {
    console.log('\n⚠️  警告: 没有找到用户资料！可能profiles表为空或user_id不匹配')
  }

  // 第四步：合并数据
  const applicationsWithProfiles = data.map((app) => {
    const profile = profiles?.find((p) => p.id === app.user_id)
    return {
      ...app,
      profiles: profile || { username: "未知用户" },
    }
  })

  console.log(`\n✅ 第三步: 数据合并成功`)
  console.log(`\n最终返回的数据:`)
  console.log('==========================================')
  applicationsWithProfiles.forEach((app, i) => {
    console.log(`\n记录 ${i + 1}:`)
    console.log(`  - 申请ID: ${app.id}`)
    console.log(`  - 商家名称: ${app.merchants?.name}`)
    console.log(`  - 押金金额: ${app.deposit_amount} USDT`)
    console.log(`  - 用户名: ${app.profiles.username}`)
  })
  console.log('\n==========================================')
}

testQuery()
  .then(() => {
    console.log('\n✅ 测试完成')
    process.exit(0)
  })
  .catch((err) => {
    console.error('❌ 执行出错:', err)
    process.exit(1)
  })
