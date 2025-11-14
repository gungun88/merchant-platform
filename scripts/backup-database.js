/**
 * 🔒 Database Backup Script (数据库备份脚本)
 *
 * 功能：
 * - 导出所有数据表为JSON格式
 * - 按日期组织备份文件
 * - 自动清理旧备份（保留最近30天）
 * - 支持增量备份和完整备份
 *
 * 使用方法：
 * node scripts/backup-database.js              # 完整备份
 * node scripts/backup-database.js --tables merchants,profiles  # 指定表备份
 */

const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

// 配置
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY // 需要Service Role密钥
const BACKUP_DIR = path.join(__dirname, '..', 'backups')
const BACKUP_RETENTION_DAYS = 30 // 保留30天的备份

// 需要备份的表
const TABLES_TO_BACKUP = [
  'profiles',
  'merchants',
  'merchant_tops',
  'merchant_views',
  'transactions',
  'rewards',
  'invitations',
  'notifications',
  'user_notifications',
]

// 验证环境变量
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ 错误: 缺少必要的环境变量')
  console.error('需要设置: NEXT_PUBLIC_SUPABASE_URL 和 SUPABASE_SERVICE_ROLE_KEY')
  console.error('\n💡 提示: Service Role Key可以在Supabase Dashboard → Settings → API中找到')
  process.exit(1)
}

// 创建Supabase客户端（使用Service Role以绕过RLS）
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

/**
 * 创建备份目录
 */
function ensureBackupDir() {
  const timestamp = new Date().toISOString().split('T')[0] // YYYY-MM-DD
  const backupPath = path.join(BACKUP_DIR, timestamp)

  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true })
  }

  if (!fs.existsSync(backupPath)) {
    fs.mkdirSync(backupPath, { recursive: true })
  }

  return backupPath
}

/**
 * 备份单个表
 */
async function backupTable(tableName, backupPath) {
  try {
    console.log(`📥 正在备份表: ${tableName}...`)

    // 分页获取所有数据（避免内存溢出）
    let allData = []
    let page = 0
    const pageSize = 1000

    while (true) {
      const { data, error, count } = await supabase
        .from(tableName)
        .select('*', { count: 'exact' })
        .range(page * pageSize, (page + 1) * pageSize - 1)

      if (error) {
        console.error(`   ❌ 备份失败: ${error.message}`)
        return { success: false, count: 0 }
      }

      if (data && data.length > 0) {
        allData = allData.concat(data)
      }

      // 如果没有更多数据，退出循环
      if (!data || data.length < pageSize) {
        break
      }

      page++
    }

    // 写入JSON文件
    const filename = path.join(backupPath, `${tableName}.json`)
    fs.writeFileSync(filename, JSON.stringify(allData, null, 2), 'utf-8')

    console.log(`   ✅ 成功备份 ${allData.length} 条记录`)
    return { success: true, count: allData.length }

  } catch (error) {
    console.error(`   ❌ 备份异常: ${error.message}`)
    return { success: false, count: 0 }
  }
}

/**
 * 备份数据库元数据（表结构、索引等）
 */
async function backupMetadata(backupPath) {
  try {
    console.log(`📥 正在备份数据库元数据...`)

    // 获取所有表的信息
    const { data: tables, error } = await supabase.rpc('get_table_info')

    if (error) {
      // 如果函数不存在，记录警告但不中断备份
      console.warn(`   ⚠️  无法获取表信息: ${error.message}`)
      console.warn(`   提示: 需要在数据库中创建 get_table_info() 函数`)
      return { success: false }
    }

    const filename = path.join(backupPath, '_metadata.json')
    fs.writeFileSync(filename, JSON.stringify(tables, null, 2), 'utf-8')

    console.log(`   ✅ 元数据备份完成`)
    return { success: true }

  } catch (error) {
    console.warn(`   ⚠️  元数据备份失败: ${error.message}`)
    return { success: false }
  }
}

/**
 * 清理旧备份
 */
function cleanOldBackups() {
  try {
    console.log(`🧹 正在清理旧备份...`)

    if (!fs.existsSync(BACKUP_DIR)) {
      return
    }

    const now = new Date()
    const dirs = fs.readdirSync(BACKUP_DIR)
    let deletedCount = 0

    dirs.forEach(dir => {
      const dirPath = path.join(BACKUP_DIR, dir)
      const stat = fs.statSync(dirPath)

      if (stat.isDirectory()) {
        const dirDate = new Date(dir) // 假设目录名是日期格式
        const ageInDays = (now - dirDate) / (1000 * 60 * 60 * 24)

        if (ageInDays > BACKUP_RETENTION_DAYS) {
          fs.rmSync(dirPath, { recursive: true })
          deletedCount++
          console.log(`   🗑️  删除旧备份: ${dir}`)
        }
      }
    })

    if (deletedCount === 0) {
      console.log(`   ✅ 无需清理旧备份`)
    } else {
      console.log(`   ✅ 清理了 ${deletedCount} 个旧备份`)
    }

  } catch (error) {
    console.warn(`   ⚠️  清理失败: ${error.message}`)
  }
}

/**
 * 创建备份摘要
 */
function createBackupSummary(backupPath, results) {
  const summary = {
    timestamp: new Date().toISOString(),
    tables: results.tables,
    totalRecords: results.tables.reduce((sum, t) => sum + t.count, 0),
    success: results.tables.every(t => t.success),
    metadata: results.metadata,
  }

  const filename = path.join(backupPath, '_summary.json')
  fs.writeFileSync(filename, JSON.stringify(summary, null, 2), 'utf-8')

  return summary
}

/**
 * 主备份函数
 */
async function performBackup(tablesToBackup = TABLES_TO_BACKUP) {
  console.log('🚀 开始数据库备份...\n')
  console.log(`📍 Supabase URL: ${SUPABASE_URL}`)
  console.log(`📁 备份目录: ${BACKUP_DIR}`)
  console.log(`📊 备份表数量: ${tablesToBackup.length}\n`)

  const startTime = Date.now()
  const backupPath = ensureBackupDir()

  // 备份所有表
  const results = {
    tables: [],
    metadata: null,
  }

  for (const tableName of tablesToBackup) {
    const result = await backupTable(tableName, backupPath)
    results.tables.push({
      table: tableName,
      success: result.success,
      count: result.count,
    })
  }

  // 备份元数据
  results.metadata = await backupMetadata(backupPath)

  // 创建备份摘要
  const summary = createBackupSummary(backupPath, results)

  // 清理旧备份
  cleanOldBackups()

  const duration = ((Date.now() - startTime) / 1000).toFixed(2)

  console.log('\n' + '='.repeat(60))
  console.log('📊 备份完成摘要:')
  console.log('='.repeat(60))
  console.log(`✅ 成功备份表: ${results.tables.filter(t => t.success).length}/${results.tables.length}`)
  console.log(`📈 总记录数: ${summary.totalRecords}`)
  console.log(`⏱️  耗时: ${duration}秒`)
  console.log(`📁 备份位置: ${backupPath}`)
  console.log('='.repeat(60))

  // 显示失败的表
  const failedTables = results.tables.filter(t => !t.success)
  if (failedTables.length > 0) {
    console.log('\n⚠️  以下表备份失败:')
    failedTables.forEach(t => console.log(`   - ${t.table}`))
  }

  return summary.success
}

/**
 * 解析命令行参数
 */
function parseArgs() {
  const args = process.argv.slice(2)
  let tablesToBackup = TABLES_TO_BACKUP

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--tables' && args[i + 1]) {
      tablesToBackup = args[i + 1].split(',').map(t => t.trim())
      break
    }
  }

  return { tablesToBackup }
}

// 执行备份
if (require.main === module) {
  const { tablesToBackup } = parseArgs()

  performBackup(tablesToBackup)
    .then(success => {
      process.exit(success ? 0 : 1)
    })
    .catch(error => {
      console.error('\n❌ 备份过程发生错误:', error)
      process.exit(1)
    })
}

module.exports = { performBackup }
