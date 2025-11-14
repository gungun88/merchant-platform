// 更新系统设置中的客服联系方式
// 用法: node scripts/update_customer_service_info.js

const fs = require('fs')
const path = require('path')
const { createClient } = require('@supabase/supabase-js')

// 读取 .env.local 文件
function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env.local')
  const envContent = fs.readFileSync(envPath, 'utf8')
  const env = {}

  envContent.split('\n').forEach(line => {
    const trimmedLine = line.trim()
    if (trimmedLine && !trimmedLine.startsWith('#')) {
      const [key, ...valueParts] = trimmedLine.split('=')
      if (key && valueParts.length > 0) {
        env[key.trim()] = valueParts.join('=').trim()
      }
    }
  })

  return env
}

const env = loadEnv()
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ 缺少必要的环境变量')
  console.error('请确保 .env.local 中配置了:')
  console.error('- NEXT_PUBLIC_SUPABASE_URL')
  console.error('- SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function updateCustomerServiceInfo() {
  console.log('🔧 开始更新客服联系方式...\n')

  // 配置你的客服联系方式
  const customerServiceInfo = {
    support_email: 'info@doingfb.com',           // 客服邮箱
    support_wechat: 'doingfb_service',           // 客服微信号
    support_telegram: '@doingfb_support',        // Telegram账号
    // support_whatsapp: '+1234567890',          // WhatsApp（可选）
  }

  try {
    // 更新系统设置（只有一条记录）
    const { data, error } = await supabase
      .from('system_settings')
      .update(customerServiceInfo)
      .eq('id', '00000000-0000-0000-0000-000000000001')
      .select()

    if (error) {
      console.error('❌ 更新失败:', error.message)
      process.exit(1)
    }

    if (data && data.length > 0) {
      console.log('✅ 客服联系方式更新成功!\n')
      console.log('📧 客服邮箱:', data[0].support_email)
      console.log('💬 客服微信:', data[0].support_wechat)
      console.log('📱 Telegram:', data[0].support_telegram)
      if (data[0].support_whatsapp) {
        console.log('📞 WhatsApp:', data[0].support_whatsapp)
      }
      console.log('\n✨ 现在用户可以在网站上看到这些联系方式了!')
    } else {
      console.log('⚠️  未找到系统设置记录')
    }
  } catch (error) {
    console.error('❌ 发生错误:', error.message)
    process.exit(1)
  }
}

updateCustomerServiceInfo()
