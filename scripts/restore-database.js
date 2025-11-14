/**
 * 🔒 Database Restore Script (数据库恢复脚本)
 *
 * 功能：
 * - 从备份文件恢复数据
 * - 支持完整恢复和选择性恢复
 * - 可选择覆盖或合并模式
 * - 恢复前自动备份当前数据
 *
 * 使用方法：
 * node scripts/restore-database.js 2025-01-14              # 恢复指定日期的完整备份
 * node scripts/restore-database.js 2025-01-14 --tables merchants  # 只恢复指定表
 * node scripts/restore-database.js 2025-01-14 --merge      # 合并模式（不删除现有数据）
 */

const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')
const readline = require('readline')

// 配置
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const BACKUP_DIR = path.join(__dirname, '..', 'backups')

// 验证环境变量
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ 错误: 缺少必要的环境变量')
  console.error('需要设置: NEXT_PUBLIC_SUPABASE_URL 和 SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

// 创建Supabase客户端
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

/**
 * 读取用户确认
 */
function askConfirmation(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  })

  return new Promise(resolve => {
    rl.question(question + ' (yes/no): ', answer => {
      rl.close()
      resolve(answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y')
    })
  })
}

/**
 * 列出可用的备份
 */
function listAvailableBackups() {
  if (!fs.existsSync(BACKUP_DIR)) {
    console.log('❌ 备份目录不存在')
    return []
  }

  const dirs = fs.readdirSync(BACKUP_DIR)
    .filter(dir => {
      const dirPath = path.join(BACKUP_DIR, dir)
      return fs.statSync(dirPath).isDirectory()
    })
    .sort()
    .reverse() // 最新的在前

  console.log('\n📁 可用的备份:')
  console.log('='.repeat(60))

  dirs.forEach((dir, index) => {
    const summaryPath = path.join(BACKUP_DIR, dir, '_summary.json')
    if (fs.existsSync(summaryPath)) {
      const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf-8'))
      console.log(`${index + 1}. ${dir} - ${summary.totalRecords} 条记录`)
    } else {
      console.log(`${index + 1}. ${dir}`)
    }
  })

  console.log('='.repeat(60))
  return dirs
}

/**
 * 恢复单个表
 */
async function restoreTable(tableName, backupPath, mergeMode = false) {
  try {
    console.log(`📤 正在恢复表: ${tableName}...`)

    // 读取备份文件
    const filename = path.join(backupPath, `${tableName}.json`)
    if (!fs.existsSync(filename)) {
      console.log(`   ⚠️  备份文件不存在，跳过`)
      return { success: false, count: 0, skipped: true }
    }

    const data = JSON.parse(fs.readFileSync(filename, 'utf-8'))

    if (!data || data.length === 0) {
      console.log(`   ⚠️  备份文件为空，跳过`)
      return { success: true, count: 0, skipped: true }
    }

    // 如果不是合并模式，先清空表
    if (!mergeMode) {
      console.log(`   🗑️  清空现有数据...`)
      const { error: deleteError } = await supabase
        .from(tableName)
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000') // 删除所有记录

      if (deleteError) {
        console.error(`   ❌ 清空表失败: ${deleteError.message}`)
        return { success: false, count: 0 }
      }
    }

    // 批量插入数据（每次1000条）
    const batchSize = 1000
    let insertedCount = 0
    let errorCount = 0

    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize)

      const { error } = await supabase
        .from(tableName)
        .upsert(batch, { onConflict: 'id' }) // 使用upsert以支持合并模式

      if (error) {
        console.error(`   ⚠️  批次 ${Math.floor(i / batchSize) + 1} 失败: ${error.message}`)
        errorCount += batch.length
      } else {
        insertedCount += batch.length
      }
    }

    console.log(`   ✅ 成功恢复 ${insertedCount} 条记录${errorCount > 0 ? ` (失败 ${errorCount} 条)` : ''}`)
    return { success: errorCount === 0, count: insertedCount }

  } catch (error) {
    console.error(`   ❌ 恢复异常: ${error.message}`)
    return { success: false, count: 0 }
  }
}

/**
 * 在恢复前创建当前数据的备份
 */
async function createSafetyBackup() {
  console.log('🔒 正在创建安全备份（恢复前备份）...\n')

  const { performBackup } = require('./backup-database.js')
  const backupSuccess = await performBackup()

  if (!backupSuccess) {
    console.error('\n⚠️  安全备份失败，建议取消恢复操作')
    return false
  }

  console.log('\n✅ 安全备份已创建\n')
  return true
}

/**
 * 主恢复函数
 */
async function performRestore(backupDate, options = {}) {
  const { tablesToRestore = null, mergeMode = false, skipSafetyBackup = false } = options

  console.log('🚀 开始数据库恢复...\n')
  console.log(`📍 Supabase URL: ${SUPABASE_URL}`)
  console.log(`📅 恢复日期: ${backupDate}`)
  console.log(`🔄 模式: ${mergeMode ? '合并模式' : '覆盖模式'}`)

  const backupPath = path.join(BACKUP_DIR, backupDate)

  // 验证备份目录是否存在
  if (!fs.existsSync(backupPath)) {
    console.error(`\n❌ 错误: 备份目录不存在: ${backupPath}`)
    console.log('\n💡 提示: 使用以下命令查看可用备份:')
    console.log('   node scripts/restore-database.js --list')
    return false
  }

  // 读取备份摘要
  const summaryPath = path.join(backupPath, '_summary.json')
  let summary = null
  if (fs.existsSync(summaryPath)) {
    summary = JSON.parse(fs.readFileSync(summaryPath, 'utf-8'))
    console.log(`📊 备份信息: ${summary.totalRecords} 条记录`)
  }

  // 确定要恢复的表
  let tables = tablesToRestore
  if (!tables) {
    // 读取备份目录中的所有JSON文件（排除元数据）
    tables = fs.readdirSync(backupPath)
      .filter(file => file.endsWith('.json') && !file.startsWith('_'))
      .map(file => file.replace('.json', ''))
  }

  console.log(`📋 待恢复表: ${tables.join(', ')}\n`)

  // 警告并请求确认
  console.log('⚠️  警告: 此操作将' + (mergeMode ? '合并' : '覆盖') + '数据库中的数据！')
  const confirmed = await askConfirmation('确认要继续吗？')

  if (!confirmed) {
    console.log('❌ 恢复操作已取消')
    return false
  }

  // 创建安全备份
  if (!skipSafetyBackup) {
    const safetyBackupSuccess = await createSafetyBackup()
    if (!safetyBackupSuccess) {
      const proceedAnyway = await askConfirmation('安全备份失败，是否仍要继续恢复？')
      if (!proceedAnyway) {
        console.log('❌ 恢复操作已取消')
        return false
      }
    }
  }

  const startTime = Date.now()

  // 恢复所有表
  const results = []
  for (const tableName of tables) {
    const result = await restoreTable(tableName, backupPath, mergeMode)
    results.push({
      table: tableName,
      success: result.success,
      count: result.count,
      skipped: result.skipped || false,
    })
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(2)

  console.log('\n' + '='.repeat(60))
  console.log('📊 恢复完成摘要:')
  console.log('='.repeat(60))
  console.log(`✅ 成功恢复表: ${results.filter(t => t.success).length}/${results.length}`)
  console.log(`📈 总记录数: ${results.reduce((sum, t) => sum + t.count, 0)}`)
  console.log(`⏱️  耗时: ${duration}秒`)
  console.log('='.repeat(60))

  // 显示失败的表
  const failedTables = results.filter(t => !t.success && !t.skipped)
  if (failedTables.length > 0) {
    console.log('\n⚠️  以下表恢复失败:')
    failedTables.forEach(t => console.log(`   - ${t.table}`))
  }

  return results.every(t => t.success || t.skipped)
}

/**
 * 解析命令行参数
 */
function parseArgs() {
  const args = process.argv.slice(2)

  // 如果只是列出备份
  if (args.includes('--list') || args.includes('-l')) {
    listAvailableBackups()
    process.exit(0)
  }

  // 第一个参数是备份日期
  const backupDate = args[0]

  if (!backupDate) {
    console.error('❌ 错误: 请指定备份日期')
    console.log('\n使用方法:')
    console.log('  node scripts/restore-database.js <backup-date>')
    console.log('  node scripts/restore-database.js --list  # 查看可用备份')
    console.log('\n示例:')
    console.log('  node scripts/restore-database.js 2025-01-14')
    console.log('  node scripts/restore-database.js 2025-01-14 --tables merchants,profiles')
    console.log('  node scripts/restore-database.js 2025-01-14 --merge')
    console.log('  node scripts/restore-database.js 2025-01-14 --skip-safety-backup')
    process.exit(1)
  }

  const options = {
    tablesToRestore: null,
    mergeMode: false,
    skipSafetyBackup: false,
  }

  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--tables' && args[i + 1]) {
      options.tablesToRestore = args[i + 1].split(',').map(t => t.trim())
      i++
    } else if (args[i] === '--merge' || args[i] === '-m') {
      options.mergeMode = true
    } else if (args[i] === '--skip-safety-backup') {
      options.skipSafetyBackup = true
    }
  }

  return { backupDate, options }
}

// 执行恢复
if (require.main === module) {
  const { backupDate, options } = parseArgs()

  performRestore(backupDate, options)
    .then(success => {
      process.exit(success ? 0 : 1)
    })
    .catch(error => {
      console.error('\n❌ 恢复过程发生错误:', error)
      process.exit(1)
    })
}

module.exports = { performRestore }
