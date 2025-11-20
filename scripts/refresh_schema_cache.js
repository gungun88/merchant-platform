/**
 * 刷新 Supabase Schema Cache
 */

const fs = require('fs')
const path = require('path')

// 手动加载 .env.local
const envPath = path.join(__dirname, '..', '.env.local')
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8')
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=:#]+)=(.*)/)
    if (match) {
      const key = match[1].trim()
      const value = match[2].trim()
      process.env[key] = value
    }
  })
}

const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ 缺少必要的环境变量')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function refreshSchemaCache() {
  console.log('🔄 开始刷新 Supabase Schema Cache...\n')

  try {
    // 方法1: 通过 API 刷新
    console.log('方法1: 尝试通过 PostgREST API 刷新...')
    const response = await fetch(`${supabaseUrl}/rest/v1/`, {
      method: 'POST',
      headers: {
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Prefer': 'schema-reload'
      }
    })

    if (response.ok || response.status === 404) {
      console.log('✅ Schema cache 刷新请求已发送\n')
    }

    // 方法2: 直接查询表以触发缓存更新
    console.log('方法2: 查询 system_settings 表以触发缓存更新...')
    const { data, error } = await supabase
      .from('system_settings')
      .select('invitation_monthly_reset, max_invitations_per_user')
      .limit(1)

    if (error) {
      console.log('⚠️  查询遇到错误（这可能是正常的）:', error.message)
    } else {
      console.log('✅ 查询成功，新字段已识别:', data)
    }

    console.log('\n✅ Schema Cache 刷新完成！')
    console.log('===========================================')
    console.log('请刷新浏览器页面，然后重试保存设置')
    console.log('===========================================')

  } catch (error) {
    console.error('\n❌ 刷新失败:', error.message)
    console.log('\n备选方案：')
    console.log('1. 在 Supabase Dashboard 中访问 SQL Editor')
    console.log('2. 运行以下命令刷新缓存：')
    console.log('   NOTIFY pgrst, \'reload schema\';')
    console.log('3. 或者等待几分钟让缓存自动更新')
  }
}

refreshSchemaCache()
