/**
 * API 签名验证工具
 * 用于验证来自论坛的 API 请求
 */

import crypto from 'crypto'

// API 密钥配置（从环境变量读取）
const API_SECRET = process.env.COIN_EXCHANGE_API_SECRET || ''

// 时间戳有效期（5分钟，单位：毫秒）
const TIMESTAMP_VALIDITY = 5 * 60 * 1000

/**
 * 生成签名
 * @param data 要签名的数据对象
 * @param secret API 密钥
 * @returns 签名字符串
 */
export function generateSignature(data: Record<string, any>, secret: string = API_SECRET): string {
  // 1. 按 key 排序
  const sortedKeys = Object.keys(data).sort()

  // 2. 拼接字符串：key1=value1&key2=value2&key3=value3
  const signString = sortedKeys
    .map(key => `${key}=${data[key]}`)
    .join('&')

  // 3. 添加密钥
  const stringToSign = `${signString}&secret=${secret}`

  // 4. SHA256 哈希
  const signature = crypto
    .createHash('sha256')
    .update(stringToSign, 'utf8')
    .digest('hex')

  return signature
}

/**
 * 验证签名
 * @param data 接收到的数据对象
 * @param receivedSignature 接收到的签名
 * @param secret API 密钥
 * @returns 是否验证通过
 */
export function verifySignature(
  data: Record<string, any>,
  receivedSignature: string,
  secret: string = API_SECRET
): boolean {
  // 生成预期的签名
  const expectedSignature = generateSignature(data, secret)

  // 比对签名（使用时序安全的比较方法）
  return crypto.timingSafeEqual(
    Buffer.from(expectedSignature, 'utf8'),
    Buffer.from(receivedSignature, 'utf8')
  )
}

/**
 * 验证时间戳（防重放攻击）
 * @param timestamp 时间戳（毫秒）
 * @param validityPeriod 有效期（毫秒），默认5分钟
 * @returns 是否在有效期内
 */
export function verifyTimestamp(
  timestamp: number,
  validityPeriod: number = TIMESTAMP_VALIDITY
): boolean {
  const now = Date.now()
  const timeDiff = Math.abs(now - timestamp)

  return timeDiff <= validityPeriod
}

/**
 * 完整的请求验证
 * @param requestData 请求数据
 * @param signature 签名
 * @returns 验证结果
 */
export interface VerificationResult {
  success: boolean
  error?: string
}

export function verifyRequest(
  requestData: Record<string, any>,
  signature: string
): VerificationResult {
  // 1. 检查 API 密钥是否配置
  if (!API_SECRET) {
    return {
      success: false,
      error: 'API_SECRET_NOT_CONFIGURED'
    }
  }

  // 2. 验证时间戳
  if (!requestData.timestamp) {
    return {
      success: false,
      error: 'MISSING_TIMESTAMP'
    }
  }

  const timestamp = parseInt(requestData.timestamp)
  if (isNaN(timestamp)) {
    return {
      success: false,
      error: 'INVALID_TIMESTAMP_FORMAT'
    }
  }

  if (!verifyTimestamp(timestamp)) {
    return {
      success: false,
      error: 'TIMESTAMP_EXPIRED'
    }
  }

  // 3. 验证签名
  try {
    if (!verifySignature(requestData, signature)) {
      return {
        success: false,
        error: 'INVALID_SIGNATURE'
      }
    }
  } catch (error) {
    return {
      success: false,
      error: 'SIGNATURE_VERIFICATION_FAILED'
    }
  }

  return { success: true }
}

/**
 * 生成用于测试的完整请求（包含签名）
 * 仅用于开发和测试环境
 */
export function generateTestRequest(data: Record<string, any>): {
  data: Record<string, any>
  signature: string
} {
  const timestamp = Date.now()
  const requestData = {
    ...data,
    timestamp
  }

  const signature = generateSignature(requestData)

  return {
    data: requestData,
    signature
  }
}
