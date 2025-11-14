/**
 * 邮箱验证测试脚本
 * 用法: node scripts/test_email_validator.js
 */

const { validateEmail, isDisposableEmail, isAllowedEmailDomain, getEmailProviderName } = require('../lib/utils/email-validator')

console.log('🧪 邮箱验证器测试\n')
console.log('='.repeat(60))

// 测试用例
const testCases = [
  // 正常邮箱
  { email: 'user@gmail.com', expected: 'valid', desc: 'Gmail - 主流邮箱' },
  { email: 'user@qq.com', expected: 'valid', desc: 'QQ邮箱 - 主流邮箱' },
  { email: 'user@163.com', expected: 'valid', desc: '网易163 - 主流邮箱' },
  { email: 'user@outlook.com', expected: 'valid', desc: 'Outlook - 主流邮箱' },

  // 一次性邮箱
  { email: 'user@tempmail.com', expected: 'disposable', desc: 'TempMail - 一次性邮箱' },
  { email: 'user@guerrillamail.com', expected: 'disposable', desc: 'Guerrilla - 一次性邮箱' },
  { email: 'user@10minutemail.com', expected: 'disposable', desc: '10分钟邮箱 - 一次性邮箱' },
  { email: 'user@yopmail.com', expected: 'disposable', desc: 'YopMail - 一次性邮箱' },

  // 不在白名单的邮箱
  { email: 'user@unknown-domain.com', expected: 'not_allowed', desc: '未知域名 - 不在白名单' },
  { email: 'user@mycompany.com', expected: 'not_allowed', desc: '企业邮箱 - 不在白名单' },

  // 格式错误
  { email: 'invalid-email', expected: 'invalid', desc: '格式错误 - 无@符号' },
  { email: 'user@', expected: 'invalid', desc: '格式错误 - 无域名' },
]

console.log('\n📋 测试用例:\n')

testCases.forEach((testCase, index) => {
  const { email, expected, desc } = testCase

  console.log(`${index + 1}. ${desc}`)
  console.log(`   邮箱: ${email}`)

  // 测试混合模式 (both)
  const result = validateEmail(email, 'both')
  console.log(`   验证结果: ${result.valid ? '✅ 通过' : '❌ 拒绝'}`)

  if (!result.valid) {
    console.log(`   拒绝原因: ${result.reason}`)
  } else {
    console.log(`   提供商: ${getEmailProviderName(email)}`)
  }

  // 单独检测
  if (email.includes('@')) {
    const isDisposable = isDisposableEmail(email)
    const isAllowed = isAllowedEmailDomain(email)
    console.log(`   一次性邮箱: ${isDisposable ? '是' : '否'}`)
    console.log(`   在白名单: ${isAllowed ? '是' : '否'}`)
  }

  console.log('')
})

console.log('='.repeat(60))
console.log('\n📊 验证模式说明:\n')
console.log('1. whitelist (白名单): 只允许主流邮箱提供商')
console.log('   - 优点: 最安全，完全可控')
console.log('   - 缺点: 可能误杀正常用户')
console.log('')
console.log('2. blacklist (黑名单): 只阻止已知一次性邮箱')
console.log('   - 优点: 更灵活，用户体验好')
console.log('   - 缺点: 可能有漏网之鱼')
console.log('')
console.log('3. both (混合模式 - 推荐): 同时使用白名单和黑名单')
console.log('   - 先检查黑名单（阻止一次性邮箱）')
console.log('   - 再检查白名单（只允许主流邮箱）')
console.log('')
console.log('='.repeat(60))
console.log('\n✨ 测试完成！\n')
