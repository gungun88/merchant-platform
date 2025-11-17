const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function checkTable() {
  const { data, error } = await supabase
    .from('platform_income')
    .select('count')
    .limit(1)

  if (error) {
    console.log('❌ platform_income 表不存在，需要运行迁移脚本')
    console.log('   请在 Supabase 控制台 SQL Editor 中运行:')
    console.log('   scripts/080_create_platform_income_table.sql')
  } else {
    console.log('✅ platform_income 表已存在')
  }
}

checkTable()
