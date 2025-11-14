// 检查 profiles 表结构
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
  envVars.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

async function checkProfilesTable() {
  console.log('🔍 检查 profiles 表结构...\n')

  try {
    // 尝试查询一个示例 profile 看看有哪些字段
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('*')
      .limit(1)

    if (error) {
      console.error('❌ 查询失败:', error.message)
      return
    }

    if (!profiles || profiles.length === 0) {
      console.log('⚠️  profiles 表为空，无法查看字段')
      console.log('   尝试查询表的元数据...')

      // 尝试插入一个测试记录看看缺少什么字段
      console.log('\n尝试手动创建 profile 测试...')
      const testId = '00000000-0000-0000-0000-000000000999'

      const { error: insertError } = await supabase
        .from('profiles')
        .insert({
          id: testId,
          username: 'test_profile',
          points: 100,
          is_merchant: false,
          invitation_code: 'TEST1234'
        })

      if (insertError) {
        console.error('❌ 插入测试记录失败:', insertError.message)
        console.error('   详细信息:', insertError)

        if (insertError.message.includes('null value in column')) {
          console.log('\n💡 发现问题: 某个必填字段为 NULL')
          console.log('   触发器可能没有设置这个字段的值')
        }
      } else {
        console.log('✅ 插入测试记录成功')
        // 删除测试记录
        await supabase.from('profiles').delete().eq('id', testId)
      }

      return
    }

    console.log('✅ 找到 profiles 表的字段结构:')
    console.log('\n字段列表:')
    const sampleProfile = profiles[0]
    Object.keys(sampleProfile).forEach(key => {
      const value = sampleProfile[key]
      const type = typeof value
      const isNull = value === null
      console.log(`  - ${key}: ${type}${isNull ? ' (NULL)' : ''}`)
    })

    console.log('\n示例数据:')
    console.log(JSON.stringify(sampleProfile, null, 2))

  } catch (err) {
    console.error('❌ 执行出错:', err.message)
    console.error(err)
  }
}

checkProfilesTable()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ 执行出错:', err)
    process.exit(1)
  })
