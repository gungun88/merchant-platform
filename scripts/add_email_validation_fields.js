/**
 * 添加邮箱验证配置字段到系统设置表
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

async function addEmailValidationFields() {
  console.log('🚀 添加邮箱验证配置字段...\n')

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
    // 执行 ALTER TABLE 添加字段
    console.log('⏳ 添加字段到 system_settings 表...')

    const alterTableSQL = `
      ALTER TABLE system_settings
        ADD COLUMN IF NOT EXISTS email_validation_enabled BOOLEAN DEFAULT true,
        ADD COLUMN IF NOT EXISTS email_validation_mode TEXT DEFAULT 'both' CHECK (email_validation_mode IN ('whitelist', 'blacklist', 'both', 'disabled')),
        ADD COLUMN IF NOT EXISTS email_allowed_domains TEXT[] DEFAULT ARRAY[
          'gmail.com', 'outlook.com', 'hotmail.com', 'yahoo.com', 'icloud.com', 'protonmail.com', 'aol.com',
          'qq.com', 'vip.qq.com', 'foxmail.com', '163.com', 'vip.163.com', '126.com', 'yeah.net', '188.com',
          'sina.com', 'sina.cn', 'sohu.com', 'tom.com', '139.com', '189.cn', 'wo.cn', 'aliyun.com'
        ],
        ADD COLUMN IF NOT EXISTS email_blocked_domains TEXT[] DEFAULT ARRAY[
          '10minutemail.com', '20minutemail.com', 'tempmail.com', 'guerrillamail.com', 'mailinator.com',
          'throwaway.email', 'yopmail.com', 'maildrop.cc', 'getnada.com', 'temp-mail.org', 'mohmal.com',
          'sharklasers.com', 'guerrillamail.info', 'grr.la', 'guerrillamailblock.com', 'pokemail.net',
          'spam4.me', 'trashmail.com', 'trashmail.net', 'emailondeck.com', 'fakeinbox.com', 'mailnesia.com',
          'mintemail.com', 'mytrashmail.com', 'tempinbox.com', 'jetable.org', 'getairmail.com',
          'dispostable.com', 'bugmenot.com', 'mt2015.com', 'bccto.me', 'disposableemailaddresses.com',
          'linshiyouxiang.net', '027168.com', 'zzrgg.com', 'bccto.cc', 'chacuo.net'
        ];
    `

    const { error: alterError } = await supabase.rpc('exec_sql', { sql_query: alterTableSQL })

    if (alterError && !alterError.message.includes('already exists')) {
      throw alterError
    }

    console.log('✅ 字段添加成功\n')

    // 更新现有记录
    console.log('⏳ 更新系统设置...')
    const { error: updateError } = await supabase
      .from('system_settings')
      .update({
        email_validation_enabled: true,
        email_validation_mode: 'both'
      })
      .eq('id', '00000000-0000-0000-0000-000000000001')

    if (updateError) {
      throw updateError
    }

    console.log('✅ 系统设置更新成功\n')

    // 验证配置
    console.log('🔍 验证配置...')
    const { data: settings, error: selectError } = await supabase
      .from('system_settings')
      .select('email_validation_enabled, email_validation_mode, email_allowed_domains, email_blocked_domains')
      .eq('id', '00000000-0000-0000-0000-000000000001')
      .single()

    if (selectError) {
      throw selectError
    }

    console.log('\n✅ 配置成功！当前设置：')
    console.log('   - 邮箱验证启用:', settings.email_validation_enabled)
    console.log('   - 验证模式:', settings.email_validation_mode)
    console.log('   - 白名单域名数量:', settings.email_allowed_domains?.length || 0)
    console.log('   - 黑名单域名数量:', settings.email_blocked_domains?.length || 0)

    if (settings.email_allowed_domains && settings.email_allowed_domains.length > 0) {
      console.log('\n📋 白名单示例 (前5个):')
      settings.email_allowed_domains.slice(0, 5).forEach(domain => {
        console.log(`   - ${domain}`)
      })
    }

    if (settings.email_blocked_domains && settings.email_blocked_domains.length > 0) {
      console.log('\n🚫 黑名单示例 (前5个):')
      settings.email_blocked_domains.slice(0, 5).forEach(domain => {
        console.log(`   - ${domain}`)
      })
    }

    console.log('\n📝 管理员可以在后台设置页面修改这些配置')

  } catch (error) {
    console.error('\n❌ 操作失败:', error.message)
    console.error('详细信息:', error)
    process.exit(1)
  }
}

addEmailValidationFields()
