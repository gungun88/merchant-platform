/**
 * 🔒 Sensitive Information Filtering (敏感信息过滤)
 *
 * 防止敏感信息泄露，包括：
 * - 数据库错误信息过滤
 * - API响应数据最小化
 * - 敏感字段过滤
 * - 错误堆栈清理
 */

/**
 * 敏感字段列表（需要在API响应中移除或脱敏）
 */
const SENSITIVE_FIELDS = [
  'password',
  'password_hash',
  'salt',
  'secret',
  'api_key',
  'access_token',
  'refresh_token',
  'private_key',
  'encryption_key',
  'session_id',
  'session_token',
  'auth_token',
  'credit_card',
  'ssn',
  'social_security_number',
] as const

/**
 * 数据库错误关键词（需要过滤的错误信息）
 */
const DATABASE_ERROR_KEYWORDS = [
  'pg_',
  'postgres',
  'postgresql',
  'supabase',
  'sql',
  'query',
  'table',
  'column',
  'constraint',
  'relation',
  'schema',
  'database',
  'connection',
  'syntax error',
  'duplicate key',
  'foreign key',
  'unique constraint',
] as const

/**
 * 系统路径关键词（需要过滤的路径信息）
 */
const SYSTEM_PATH_KEYWORDS = [
  'c:',
  'd:',
  '/home/',
  '/usr/',
  '/var/',
  '/etc/',
  'node_modules',
  'webpack',
  'internal',
] as const

/**
 * 通用错误消息接口
 */
export interface SafeErrorResponse {
  success: false
  error: string
  code?: string
}

/**
 * 检测字符串是否包含敏感信息
 * @param text 要检查的文本
 * @returns 是否包含敏感信息
 */
export function containsSensitiveInfo(text: string): boolean {
  if (!text) return false

  const lowerText = text.toLowerCase()

  // 检查数据库错误关键词
  const hasDatabaseError = DATABASE_ERROR_KEYWORDS.some(keyword =>
    lowerText.includes(keyword.toLowerCase())
  )

  // 检查系统路径
  const hasSystemPath = SYSTEM_PATH_KEYWORDS.some(keyword =>
    lowerText.includes(keyword.toLowerCase())
  )

  return hasDatabaseError || hasSystemPath
}

/**
 * 过滤数据库错误信息
 * @param error 原始错误对象或字符串
 * @returns 安全的错误消息
 */
export function filterDatabaseError(error: any): string {
  if (!error) return '操作失败，请稍后重试'

  // 如果是字符串
  if (typeof error === 'string') {
    if (containsSensitiveInfo(error)) {
      return '数据库操作失败，请联系管理员'
    }
    return error
  }

  // 如果是Error对象
  if (error instanceof Error) {
    if (containsSensitiveInfo(error.message)) {
      console.error('[安全日志] 过滤了包含敏感信息的错误:', error.message)
      return '操作失败，请稍后重试'
    }
    return error.message
  }

  // 如果是Supabase错误对象
  if (error.message) {
    if (containsSensitiveInfo(error.message)) {
      console.error('[安全日志] 过滤了包含敏感信息的错误:', error.message)
      return '操作失败，请稍后重试'
    }
    return error.message
  }

  return '未知错误，请稍后重试'
}

/**
 * 移除对象中的敏感字段
 * @param obj 要处理的对象
 * @param additionalFields 额外需要移除的字段
 * @returns 清理后的对象
 */
export function removeSensitiveFields<T extends Record<string, any>>(
  obj: T,
  additionalFields: string[] = []
): Partial<T> {
  if (!obj || typeof obj !== 'object') return obj

  const result: any = {}
  const fieldsToRemove = new Set([...SENSITIVE_FIELDS, ...additionalFields])

  for (const key in obj) {
    // 跳过敏感字段
    if (fieldsToRemove.has(key.toLowerCase())) {
      continue
    }

    const value = obj[key]

    // 递归处理嵌套对象
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = removeSensitiveFields(value, additionalFields)
    }
    // 递归处理数组
    else if (Array.isArray(value)) {
      result[key] = value.map(item =>
        typeof item === 'object' && item !== null
          ? removeSensitiveFields(item, additionalFields)
          : item
      )
    }
    // 保留其他值
    else {
      result[key] = value
    }
  }

  return result
}

/**
 * 脱敏敏感字段（保留部分信息）
 * @param value 要脱敏的值
 * @param visibleChars 保留可见字符数量
 * @returns 脱敏后的值
 */
export function maskSensitiveValue(value: string, visibleChars: number = 4): string {
  if (!value || value.length <= visibleChars) {
    return '***'
  }

  const visible = value.slice(0, visibleChars)
  const masked = '*'.repeat(Math.min(value.length - visibleChars, 8))

  return visible + masked
}

/**
 * 脱敏邮箱地址
 * @param email 邮箱地址
 * @returns 脱敏后的邮箱
 */
export function maskEmail(email: string): string {
  if (!email || !email.includes('@')) return '***@***.com'

  const [username, domain] = email.split('@')
  const maskedUsername = username.length > 2
    ? username[0] + '***' + username[username.length - 1]
    : '***'

  return `${maskedUsername}@${domain}`
}

/**
 * 脱敏手机号
 * @param phone 手机号
 * @returns 脱敏后的手机号
 */
export function maskPhone(phone: string): string {
  if (!phone || phone.length < 7) return '***'

  const visible = phone.slice(0, 3)
  const masked = '****'
  const lastDigits = phone.slice(-4)

  return visible + masked + lastDigits
}

/**
 * 清理错误堆栈信息
 * @param stack 错误堆栈字符串
 * @returns 清理后的堆栈（仅保留错误类型和消息）
 */
export function sanitizeErrorStack(stack: string | undefined): string | undefined {
  if (!stack) return undefined

  // 只保留第一行（错误类型和消息）
  const firstLine = stack.split('\n')[0]

  // 移除文件路径信息
  return firstLine.replace(/\s+at\s+.*/g, '').trim()
}

/**
 * 创建安全的错误响应（用于API）
 * @param error 原始错误
 * @param defaultMessage 默认错误消息
 * @returns 安全的错误响应对象
 */
export function createSafeErrorResponse(
  error: any,
  defaultMessage: string = '操作失败'
): SafeErrorResponse {
  const filteredMessage = filterDatabaseError(error)

  // 如果错误消息被过滤（包含敏感信息），使用默认消息
  const errorMessage = filteredMessage === '操作失败，请稍后重试'
    ? defaultMessage
    : filteredMessage

  return {
    success: false,
    error: errorMessage,
  }
}

/**
 * 记录安全日志（用于服务端）
 * @param level 日志级别
 * @param message 日志消息
 * @param metadata 元数据
 */
export function logSecurityEvent(
  level: 'info' | 'warn' | 'error',
  message: string,
  metadata?: Record<string, any>
) {
  const timestamp = new Date().toISOString()
  const logPrefix = `[安全日志 ${timestamp}] [${level.toUpperCase()}]`

  // 移除敏感字段
  const safeMetadata = metadata ? removeSensitiveFields(metadata) : {}

  const logMessage = `${logPrefix} ${message}`

  switch (level) {
    case 'error':
      console.error(logMessage, safeMetadata)
      break
    case 'warn':
      console.warn(logMessage, safeMetadata)
      break
    case 'info':
    default:
      console.log(logMessage, safeMetadata)
      break
  }
}

/**
 * 验证并清理API响应数据
 * @param data API响应数据
 * @param options 清理选项
 * @returns 清理后的数据
 */
export function sanitizeApiResponse<T>(
  data: T,
  options: {
    removeSensitiveFields?: boolean
    additionalFieldsToRemove?: string[]
  } = {}
): T {
  const {
    removeSensitiveFields: shouldRemove = true,
    additionalFieldsToRemove = [],
  } = options

  if (!shouldRemove || !data || typeof data !== 'object') {
    return data
  }

  return removeSensitiveFields(data as any, additionalFieldsToRemove) as T
}

/**
 * 检测并报告可疑活动
 * @param activity 活动描述
 * @param userId 用户ID
 * @param metadata 元数据
 */
export function reportSuspiciousActivity(
  activity: string,
  userId: string,
  metadata?: Record<string, any>
) {
  logSecurityEvent('warn', `可疑活动: ${activity}`, {
    userId,
    ...metadata,
  })

  // 这里可以集成到日志系统或监控系统
  // 例如：发送到Sentry、DataDog等
}

/**
 * 过滤Supabase错误详情
 * @param error Supabase错误对象
 * @returns 安全的错误信息
 */
export function filterSupabaseError(error: any): {
  message: string
  code?: string
} {
  if (!error) {
    return { message: '操作失败' }
  }

  // Supabase错误对象包含: message, details, hint, code
  const safeError: { message: string; code?: string } = {
    message: filterDatabaseError(error.message || error),
  }

  // 保留错误代码（不包含敏感信息）
  if (error.code && typeof error.code === 'string') {
    // 只保留特定的错误代码
    const allowedCodes = ['23505', '23503', '42P01', 'PGRST'] // 例如：重复键、外键约束等
    if (allowedCodes.some(code => error.code.startsWith(code))) {
      safeError.code = error.code
    }
  }

  return safeError
}

/**
 * 限制返回数据的字段（API响应最小化）
 * @param data 原始数据对象或数组
 * @param allowedFields 允许返回的字段列表
 * @returns 仅包含允许字段的数据
 */
export function limitResponseFields<T extends Record<string, any>>(
  data: T | T[],
  allowedFields: (keyof T)[]
): Partial<T> | Partial<T>[] {
  if (Array.isArray(data)) {
    return data.map(item => limitResponseFields(item, allowedFields)) as Partial<T>[]
  }

  const result: Partial<T> = {}
  for (const field of allowedFields) {
    if (field in data) {
      result[field] = data[field]
    }
  }

  return result
}
