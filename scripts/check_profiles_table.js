// 检查 profiles 表结构
const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

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

async function checkProfilesTable() {
  console.log('检查 profiles 表结构...\n')

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .limit(1)

  if (error) {
    console.error('查询失败:', error)
    return
  }

  if (data && data.length > 0) {
    console.log('profiles 表的字段:')
    console.log(Object.keys(data[0]))
    console.log('\n第一条记录示例:')
    console.log(data[0])
  } else {
    console.log('profiles 表为空')
  }
}

checkProfilesTable()
  .then(() => {
    console.log('\n✅ 检查完成')
    process.exit(0)
  })
  .catch((err) => {
    console.error('❌ 执行出错:', err)
    process.exit(1)
  })
