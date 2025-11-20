// 检查 invitation_code_required 字段是否存在
require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ 缺少 Supabase 配置')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkField() {
  console.log('🔍 检查 system_settings 表结构...\n')

  // 1. 查询当前表的所有字段
  const { data, error } = await supabase
    .from('system_settings')
    .select('*')
    .limit(1)

  if (error) {
    console.error('❌ 查询失败:', error.message)
    return
  }

  if (data && data.length > 0) {
    console.log('✅ 表中的所有字段:')
    const fields = Object.keys(data[0])
    fields.forEach(field => {
      console.log(`   - ${field}`)
    })

    console.log('\n🔍 检查 invitation_code_required 字段:')
    if (fields.includes('invitation_code_required')) {
      console.log('✅ invitation_code_required 字段存在')
      console.log(`   值: ${data[0].invitation_code_required}`)
    } else {
      console.log('❌ invitation_code_required 字段不存在!')
    }
  }
}

checkField()
