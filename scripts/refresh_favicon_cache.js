// 刷新 schema cache 并添加 favicon 字段
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

async function refreshSchemaCache() {
  console.log('🔄 正在刷新 schema cache 并添加 favicon 字段...\n')

  try {
    // 第一步: 检查字段是否存在
    console.log('步骤 1: 检查 site_favicon_url 字段是否存在...')
    const { data: checkData, error: checkError } = await supabase
      .from('system_settings')
      .select('id, platform_name, site_favicon_url')
      .limit(1)

    if (checkError) {
      if (checkError.message.includes('site_favicon_url')) {
        console.log('⚠️  字段不存在,需要手动添加\n')
        console.log('请在 Supabase SQL 编辑器中执行以下 SQL:\n')
        console.log('------------------------------------')
        console.log('ALTER TABLE system_settings')
        console.log('ADD COLUMN IF NOT EXISTS site_favicon_url TEXT;')
        console.log('')
        console.log('COMMENT ON COLUMN system_settings.site_favicon_url IS')
        console.log("  '网站 Favicon 图标 URL (显示在浏览器标签页、书签等位置)';")
        console.log('')
        console.log('NOTIFY pgrst, \'reload schema\';')
        console.log('------------------------------------')
        console.log('')
        console.log('📍 Supabase Dashboard 路径:')
        console.log(`   ${envVars.NEXT_PUBLIC_SUPABASE_URL.replace('/rest/v1', '')}/project/_/sql`)
        console.log('')
        console.log('执行完成后,请等待 5-10 秒让 PostgREST 刷新缓存,然后刷新页面。')
      } else {
        throw checkError
      }
    } else {
      console.log('✅ site_favicon_url 字段已存在')
      console.log('当前数据:', checkData)
      console.log('')
      console.log('✅ Schema cache 已同步,可以正常使用了!')
    }
  } catch (err) {
    console.error('❌ 执行出错:', err.message)
    console.log('')
    console.log('💡 解决方案:')
    console.log('1. 打开 Supabase Dashboard SQL 编辑器')
    console.log('2. 执行上面显示的 SQL 语句')
    console.log('3. 等待 5-10 秒')
    console.log('4. 刷新浏览器页面')
    process.exit(1)
  }
}

refreshSchemaCache()
  .then(() => {
    console.log('\n✅ 完成')
    process.exit(0)
  })
  .catch((err) => {
    console.error('❌ 执行出错:', err)
    process.exit(1)
  })
