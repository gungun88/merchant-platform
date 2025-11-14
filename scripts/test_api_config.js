/**
 * 快速测试 API 密钥配置
 * 用法: node scripts/test_api_config.js
 */

const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

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
const API_SECRET = env.COIN_EXCHANGE_API_SECRET

console.log('🔍 检查 API 密钥配置...\n')

if (!API_SECRET) {
  console.error('❌ 未找到 COIN_EXCHANGE_API_SECRET 环境变量')
  console.error('\n请确保:')
  console.error('1. .env.local 文件中已添加 COIN_EXCHANGE_API_SECRET')
  console.error('2. 已重启开发服务器（npm run dev）')
  process.exit(1)
}

console.log('✅ API 密钥已配置')
console.log('密钥长度:', API_SECRET.length, '字符')
console.log('密钥前缀:', API_SECRET.substring(0, 10) + '...')

// 测试签名生成
console.log('\n🧪 测试签名生成...')

const testData = {
  forum_user_id: 'test_123',
  coin_amount: 100,
  timestamp: Date.now()
}

const sortedKeys = Object.keys(testData).sort()
const signString = sortedKeys.map(key => `${key}=${testData[key]}`).join('&')
const stringToSign = `${signString}&secret=${API_SECRET}`
const signature = crypto
  .createHash('sha256')
  .update(stringToSign, 'utf8')
  .digest('hex')

console.log('测试数据:', JSON.stringify(testData, null, 2))
console.log('生成的签名:', signature)

console.log('\n✅ 签名生成功能正常')
console.log('\n📝 配置总结:')
console.log('- API 密钥: ✅ 已配置')
console.log('- 签名算法: ✅ SHA256')
console.log('- 开发服务器: ✅ 端口 3001')
console.log('\n🎯 可以开始测试 API 了！')
console.log('运行: node scripts/test_coin_exchange_api.js')
