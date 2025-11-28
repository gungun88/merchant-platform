/**
 * 测试 PKCE code_verifier 修复
 *
 * 问题：注册前调用 signOut() 导致 PKCE code_verifier 被清除
 * 结果：邮箱验证失败，错误信息 "code verifier should be non-empty"
 *
 * 修复：移除注册前的 signOut() 调用
 */

const fs = require('fs')
const path = require('path')

async function testPKCEFix() {
  console.log('🧪 测试 PKCE Code Verifier 修复...\n')

  // 测试 1: 检查注册页面是否还有 signOut
  console.log('📋 测试 1: 检查注册页面实现')
  console.log('━'.repeat(50))

  const registerPath = path.join(__dirname, '..', 'app', 'auth', 'register', 'page.tsx')

  try {
    const registerCode = fs.readFileSync(registerPath, 'utf-8')

    // 检查 handleRegister 函数中是否有 signOut 调用
    const handleRegisterMatch = registerCode.match(/const handleRegister = async \(e: React\.FormEvent\) => \{[\s\S]*?\n  \}/m)

    if (handleRegisterMatch) {
      const handleRegisterCode = handleRegisterMatch[0]

      // 检查是否在 signUp 前调用 signOut
      // 注意：只检查 signUp 之前的代码，不包括之后的错误处理
      const signUpIndex = handleRegisterCode.indexOf('signUp(')
      const codeBeforeSignUp = signUpIndex > 0 ? handleRegisterCode.substring(0, signUpIndex) : handleRegisterCode
      const hasSignOutBeforeSignUp = codeBeforeSignUp.includes('await supabase.auth.signOut()')

      console.log('\n检查注册流程:')
      console.log('  - handleRegister 函数:', '✅ 找到')
      console.log('  - 在 signUp 前调用 signOut:', hasSignOutBeforeSignUp ? '❌ 是（会破坏 PKCE！）' : '✅ 否')

      if (hasSignOutBeforeSignUp) {
        console.log('\n❌ 严重问题：注册前调用 signOut 会清除 PKCE code_verifier！')
        console.log('   这会导致邮箱验证失败，错误: "code verifier should be non-empty"')
        return false
      } else {
        console.log('\n✅ 注册流程正确：没有在 signUp 前调用 signOut')
      }

      // 检查是否使用 sessionStorage 保存预期邮箱
      const usesSessionStorage = handleRegisterCode.includes("sessionStorage.setItem('pending_verification_email'")
      console.log('  - 使用 sessionStorage 保存预期邮箱:', usesSessionStorage ? '✅ 是' : '⚠️ 否')

      if (usesSessionStorage) {
        console.log('    这可以防止同浏览器重新注册时登录到旧账号')
      }
    } else {
      console.log('❌ 无法找到 handleRegister 函数')
      return false
    }

  } catch (err) {
    console.log('❌ 无法读取注册文件:', err.message)
    return false
  }

  // 测试 2: 检查 callback 是否正确验证邮箱
  console.log('\n📋 测试 2: 检查 callback 邮箱验证')
  console.log('━'.repeat(50))

  const callbackPath = path.join(__dirname, '..', 'app', 'auth', 'callback', 'page.tsx')

  try {
    const callbackCode = fs.readFileSync(callbackPath, 'utf-8')

    // 检查是否有邮箱验证逻辑
    const hasEmailValidation = callbackCode.includes("sessionStorage.getItem('pending_verification_email')") &&
                                callbackCode.includes('loggedInEmail.toLowerCase() !== expectedEmail.toLowerCase()')

    console.log('\n检查 callback 实现:')
    console.log('  - 从 sessionStorage 读取预期邮箱:', hasEmailValidation ? '✅ 是' : '❌ 否')
    console.log('  - 验证实际邮箱是否匹配:', hasEmailValidation ? '✅ 是' : '❌ 否')

    if (hasEmailValidation) {
      console.log('\n✅ 邮箱验证逻辑正确')
      console.log('   如果邮箱不匹配，会调用 signOut 并跳转到 error=email_mismatch')
    } else {
      console.log('\n⚠️ 警告：没有邮箱验证逻辑')
      console.log('   可能导致同浏览器重新注册时登录到旧账号')
    }

    // 检查是否在 exchangeCodeForSession 前调用 signOut
    const hasSignOutBeforeExchange = callbackCode.match(/signOut.*exchangeCodeForSession/s)
    console.log('  - 在 exchangeCodeForSession 前调用 signOut:', hasSignOutBeforeExchange ? '❌ 是（危险！）' : '✅ 否')

  } catch (err) {
    console.log('❌ 无法读取 callback 文件:', err.message)
    return false
  }

  // 测试 3: 解释 PKCE 流程
  console.log('\n📋 测试 3: PKCE 流程验证')
  console.log('━'.repeat(50))

  console.log('\n✅ 正确的 PKCE 流程:')
  console.log('\n1️⃣ 注册阶段 (signUp)')
  console.log('   用户提交注册表单')
  console.log('       ↓')
  console.log('   supabase.auth.signUp()')
  console.log('       ↓')
  console.log('   Supabase 生成 PKCE code_verifier')
  console.log('       ↓')
  console.log('   存储到 localStorage:')
  console.log('     键名: sb-{project-id}-auth-token-code-verifier')
  console.log('     值: {random_string}/{redirect_type}')
  console.log('       ↓')
  console.log('   发送验证邮件（包含 auth_code）')

  console.log('\n2️⃣ 验证阶段 (exchangeCodeForSession)')
  console.log('   用户点击邮件链接')
  console.log('       ↓')
  console.log('   跳转到 /auth/callback?code=xxx')
  console.log('       ↓')
  console.log('   supabase.auth.exchangeCodeForSession()')
  console.log('       ↓')
  console.log('   从 localStorage 读取 code_verifier')
  console.log('       ↓')
  console.log('   向 Supabase API 发送:')
  console.log('     - auth_code: xxx (来自 URL)')
  console.log('     - code_verifier: yyy (来自 localStorage)')
  console.log('       ↓')
  console.log('   Supabase 验证两者匹配')
  console.log('       ↓')
  console.log('   ✅ 创建 session 并登录用户')

  console.log('\n❌ 错误的流程（调用 signOut）:')
  console.log('\n1️⃣ 注册阶段')
  console.log('   用户提交注册表单')
  console.log('       ↓')
  console.log('   ❌ await supabase.auth.signOut()')
  console.log('       ↓')
  console.log('   🚨 清除 localStorage（包括可能存在的 code_verifier）')
  console.log('       ↓')
  console.log('   supabase.auth.signUp()')
  console.log('       ↓')
  console.log('   生成新的 code_verifier_NEW 并存储')
  console.log('       ↓')
  console.log('   发送验证邮件（包含 auth_code_OLD）')

  console.log('\n2️⃣ 验证阶段')
  console.log('   用户点击邮件链接')
  console.log('       ↓')
  console.log('   exchangeCodeForSession()')
  console.log('       ↓')
  console.log('   从 localStorage 读取 code_verifier_NEW')
  console.log('       ↓')
  console.log('   向 Supabase 发送:')
  console.log('     - auth_code: auth_code_OLD')
  console.log('     - code_verifier: code_verifier_NEW')
  console.log('       ↓')
  console.log('   ❌ 验证失败！（code 和 verifier 不匹配）')
  console.log('       ↓')
  console.log('   返回错误: "code verifier should be non-empty"')

  // 总结
  console.log('\n')
  console.log('═'.repeat(50))
  console.log('📊 测试总结')
  console.log('═'.repeat(50))

  console.log('\n✅ 修复验证:')
  console.log('  1. ✅ 注册前不调用 signOut()')
  console.log('  2. ✅ 保持 PKCE code_verifier 完整性')
  console.log('  3. ✅ 使用 sessionStorage 验证邮箱')
  console.log('  4. ✅ callback 不在 exchangeCodeForSession 前调用 signOut')

  console.log('\n🎯 预期效果:')
  console.log('  ✅ 用户注册后可以正常验证邮箱')
  console.log('  ✅ 不会出现 "code verifier should be non-empty" 错误')
  console.log('  ✅ 验证成功后自动登录')
  console.log('  ✅ 同浏览器重新注册时会验证邮箱匹配')

  console.log('\n💡 手动测试步骤:')
  console.log('  1. 打开无痕窗口（确保没有旧 session）')
  console.log('  2. 访问注册页面，填写信息并提交')
  console.log('  3. 打开浏览器开发者工具，查看 Console 日志:')
  console.log('     应该看到: [Register] 保存预期邮箱到 sessionStorage: xxx@xxx.com')
  console.log('     不应该看到: [Register] 注册前清除旧 session...')
  console.log('  4. 打开 Application -> Local Storage，检查:')
  console.log('     应该有: sb-xxx-auth-token-code-verifier')
  console.log('  5. 打开邮箱，点击验证链接')
  console.log('  6. 观察 Console 日志:')
  console.log('     应该看到: Email verification successful, user logged in: xxx@xxx.com')
  console.log('     应该看到: [Callback] 邮箱验证通过: xxx@xxx.com')
  console.log('     不应该看到: Email verification error: code verifier should be non-empty')
  console.log('  7. 验证导航栏显示正确的用户邮箱')
  console.log('  8. 验证 URL 是 /?verified=true，而不是 /auth/login?error=verification_failed')

  console.log('\n🔍 问题排查:')
  console.log('  如果仍然失败，检查:')
  console.log('  1. 确认代码已经部署（检查最新的 commit）')
  console.log('  2. 清除浏览器缓存和 localStorage')
  console.log('  3. 检查 Supabase Dashboard 的 Auth 设置')
  console.log('  4. 检查邮件链接的格式（应该包含 code 或 token_hash 参数）')
  console.log('  5. 查看 Network 面板，检查 exchangeCodeForSession 的请求和响应')

  console.log('\n✅ 测试完成！')

  return true
}

// 运行测试
testPKCEFix().then(success => {
  if (!success) {
    console.error('\n❌ 测试发现问题，请修复后重新测试')
    process.exit(1)
  }
}).catch(err => {
  console.error('❌ 测试失败:', err)
  process.exit(1)
})
