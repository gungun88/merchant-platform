/**
 * 添加邮箱验证配置 - 通过直接更新实现
 */

const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

// 读取 .env.local 文件
function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env.local')
  const envFile = fs.readFileSync(envPath, 'utf8')
  const env = {}

  envFile.split('\n').forEach(line => {
    const trimmed = line.trim()
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...values] = trimmed.split('=')
      env[key.trim()] = values.join('=').trim()
    }
  })

  return env
}

const env = loadEnv()

async function setupEmailValidation() {
  console.log('🚀 设置邮箱验证配置...\n')

  const supabase = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  )

  try {
    // 读取当前配置
    console.log('⏳ 读取当前系统设置...')
    const { data: currentSettings, error: readError } = await supabase
      .from('system_settings')
      .select('*')
      .eq('id', '00000000-0000-0000-0000-000000000001')
      .single()

    if (readError) {
      throw readError
    }

    console.log('✅ 当前设置已读取\n')

    // 检查字段是否已存在
    if ('email_validation_enabled' in currentSettings) {
      console.log('ℹ️  邮箱验证字段已存在')
      console.log('   - 启用状态:', currentSettings.email_validation_enabled)
      console.log('   - 验证模式:', currentSettings.email_validation_mode)
      console.log('   - 白名单数量:', currentSettings.email_allowed_domains?.length || 0)
      console.log('   - 黑名单数量:', currentSettings.email_blocked_domains?.length || 0)
      console.log('\n✅ 配置已完成，无需更新')
      return
    }

    console.log('⚠️  邮箱验证字段不存在')
    console.log('\n请手动执行以下步骤：')
    console.log('1. 登录 Supabase Dashboard')
    console.log('2. 进入 SQL Editor')
    console.log('3. 执行文件: scripts/053_add_email_validation_settings.sql')
    console.log('\n或者复制以下 SQL 语句执行：\n')

    const sqlPath = path.join(__dirname, '053_add_email_validation_settings.sql')
    const sql = fs.readFileSync(sqlPath, 'utf8')
    console.log('```sql')
    console.log(sql)
    console.log('```')

  } catch (error) {
    console.error('\n❌ 操作失败:', error.message)
    console.error('详细信息:', error)
    process.exit(1)
  }
}

setupEmailValidation()
