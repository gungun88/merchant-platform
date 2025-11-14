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
const supabaseServiceKey = envVars.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ 缺少环境变量')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function checkProfilesFields() {
  try {
    console.log('🔍 查询profiles表结构...\n')

    // 查询一条记录看看有哪些字段
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .limit(1)

    if (error) {
      console.error('❌ 查询失败:', error)
      return
    }

    if (data && data.length > 0) {
      console.log('✅ profiles表字段:')
      console.log(Object.keys(data[0]))
      console.log('\n示例数据:')
      console.log(data[0])
    } else {
      console.log('⚠️ 没有数据')
    }
  } catch (error) {
    console.error('❌ 发生错误:', error)
  }
}

checkProfilesFields()
