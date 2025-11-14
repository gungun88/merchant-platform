const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

// Read .env.local manually
const envPath = path.join(__dirname, '..', '.env.local')
const envContent = fs.readFileSync(envPath, 'utf-8')

let supabaseUrl = null
let supabaseServiceKey = null

envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/)
  if (match) {
    const key = match[1].trim()
    const value = match[2].trim()
    if (key === 'NEXT_PUBLIC_SUPABASE_URL') supabaseUrl = value
    if (key === 'SUPABASE_SERVICE_ROLE_KEY') supabaseServiceKey = value
  }
})

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function checkDepositAmounts() {
  console.log('🔍 Checking deposit merchants...\n')

  try {
    // Query all deposit merchants
    const { data: merchants, error } = await supabase
      .from('merchants')
      .select('id, name, is_deposit_merchant, deposit_amount, deposit_status, updated_at')
      .eq('is_deposit_merchant', true)
      .order('updated_at', { ascending: false })

    if (error) {
      console.error('❌ Query error:', error)
      return
    }

    if (!merchants || merchants.length === 0) {
      console.log('ℹ️ No deposit merchants found')
      return
    }

    console.log(`Found ${merchants.length} deposit merchant(s):\n`)

    merchants.forEach((merchant, index) => {
      console.log(`${index + 1}. ${merchant.name}`)
      console.log(`   ID: ${merchant.id}`)
      console.log(`   Deposit Amount: ${merchant.deposit_amount} USDT`)
      console.log(`   Deposit Status: ${merchant.deposit_status}`)
      console.log(`   Is Deposit Merchant: ${merchant.is_deposit_merchant}`)
      console.log(`   Last Updated: ${new Date(merchant.updated_at).toLocaleString('zh-CN')}`)
      console.log('')
    })

  } catch (err) {
    console.error('❌ Unexpected error:', err)
  }
}

checkDepositAmounts()
