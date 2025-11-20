/**
 * 验证新字段是否已正确添加到数据库
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

async function verifyColumns() {
  console.log('🔍 开始验证数据库字段...\n')

  try {
    // 验证 system_settings 表
    console.log('1️⃣ 检查 system_settings 表中的字段...')
    const { data: settings, error: settingsError } = await supabase
      .from('system_settings')
      .select('invitation_monthly_reset, max_invitations_per_user')
      .limit(1)
      .maybeSingle()

    if (settingsError) {
      console.error('❌ system_settings 查询失败:', settingsError.message)
    } else {
      console.log('✅ system_settings 字段存在')
      console.log('   - invitation_monthly_reset:', settings?.invitation_monthly_reset ?? '(无数据)')
      console.log('   - max_invitations_per_user:', settings?.max_invitations_per_user ?? '(无数据)')
    }

    console.log()

    // 验证 profiles 表
    console.log('2️⃣ 检查 profiles 表中的字段...')
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('invitation_reset_month, max_invitations, used_invitations')
      .limit(1)
      .maybeSingle()

    if (profileError) {
      console.error('❌ profiles 查询失败:', profileError.message)
    } else {
      console.log('✅ profiles 字段存在')
      console.log('   - invitation_reset_month:', profile?.invitation_reset_month ?? '(无数据)')
      console.log('   - max_invitations:', profile?.max_invitations ?? '(无数据)')
      console.log('   - used_invitations:', profile?.used_invitations ?? '(无数据)')
    }

    console.log('\n✅ 字段验证完成！')

  } catch (error) {
    console.error('\n❌ 验证失败:', error.message)
  }
}

verifyColumns()
