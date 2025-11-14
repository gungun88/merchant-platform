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

const sqlFilePath = process.argv[2]

if (!sqlFilePath) {
  console.error('❌ 请提供 SQL 文件路径作为参数')
  console.log('用法: node scripts/apply_rls_fix.js <sql-file-path>')
  process.exit(1)
}

const fullPath = path.isAbsolute(sqlFilePath)
  ? sqlFilePath
  : path.join(__dirname, '..', sqlFilePath)

if (!fs.existsSync(fullPath)) {
  console.error(`❌ SQL 文件不存在: ${fullPath}`)
  process.exit(1)
}

console.log(`📄 正在读取 SQL 文件: ${sqlFilePath}`)
const sqlContent = fs.readFileSync(fullPath, 'utf-8')

console.log('\n================== SQL 内容 ==================')
console.log(sqlContent)
console.log('==============================================\n')

console.log('⚠️  请按以下步骤手动执行此迁移:')
console.log('')
console.log('1. 打开 Supabase 项目控制台')
console.log('2. 进入 SQL Editor')
console.log('3. 复制上面的 SQL 内容并粘贴到编辑器中')
console.log('4. 点击 RUN 执行')
console.log('')
console.log('完成后，按 Ctrl+C 退出此脚本')
console.log('')

// 保持进程运行，方便用户复制
process.stdin.resume()
