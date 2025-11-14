/**
 * 🔒 Rate Limiting System (防刷限流系统)
 *
 * 基于内存的速率限制系统，防止API滥用和刷单攻击
 * Memory-based rate limiting to prevent API abuse and spam attacks
 */

interface RateLimitRecord {
  count: number
  resetTime: number
}

// 全局速率限制存储（内存）
// 注意：这种方式仅适用于单服务器部署
// 如果需要多服务器支持，请使用 Redis 替代
const rateLimitStore = new Map<string, RateLimitRecord>()

// 定期清理过期记录（每5分钟）
setInterval(() => {
  const now = Date.now()
  for (const [key, record] of rateLimitStore.entries()) {
    if (now > record.resetTime) {
      rateLimitStore.delete(key)
    }
  }
}, 5 * 60 * 1000)

export interface RateLimitConfig {
  /** 时间窗口（秒） */
  windowSeconds: number
  /** 允许的最大请求数 */
  maxRequests: number
  /** 唯一标识符（用户ID、IP地址等） */
  identifier: string
  /** 操作类型（用于区分不同的限流规则） */
  action: string
}

export interface RateLimitResult {
  /** 是否允许请求 */
  allowed: boolean
  /** 当前请求数 */
  currentCount: number
  /** 最大请求数 */
  limit: number
  /** 剩余请求数 */
  remaining: number
  /** 重置时间（Unix时间戳） */
  resetTime: number
  /** 距离重置还有多少秒 */
  retryAfter: number
}

/**
 * 速率限制检查
 * @param config 限流配置
 * @returns 限流结果
 */
export function checkRateLimit(config: RateLimitConfig): RateLimitResult {
  const { identifier, action, windowSeconds, maxRequests } = config
  const key = `${action}:${identifier}`
  const now = Date.now()

  // 获取当前记录
  let record = rateLimitStore.get(key)

  // 如果没有记录或记录已过期，创建新记录
  if (!record || now > record.resetTime) {
    record = {
      count: 0,
      resetTime: now + windowSeconds * 1000,
    }
  }

  // 增加计数
  record.count++
  rateLimitStore.set(key, record)

  // 计算结果
  const allowed = record.count <= maxRequests
  const remaining = Math.max(0, maxRequests - record.count)
  const retryAfter = Math.ceil((record.resetTime - now) / 1000)

  return {
    allowed,
    currentCount: record.count,
    limit: maxRequests,
    remaining,
    resetTime: record.resetTime,
    retryAfter,
  }
}

/**
 * 重置特定用户和操作的速率限制
 * @param identifier 用户标识
 * @param action 操作类型
 */
export function resetRateLimit(identifier: string, action: string): void {
  const key = `${action}:${identifier}`
  rateLimitStore.delete(key)
}

/**
 * 预定义的速率限制规则
 */
export const RATE_LIMITS = {
  // 🔒 签到限制：每天1次
  CHECKIN: {
    windowSeconds: 24 * 60 * 60, // 24小时
    maxRequests: 1,
    action: "checkin",
  },

  // 🔒 商家创建：每天3次
  CREATE_MERCHANT: {
    windowSeconds: 24 * 60 * 60,
    maxRequests: 3,
    action: "create_merchant",
  },

  // 🔒 商家编辑：每小时5次
  EDIT_MERCHANT: {
    windowSeconds: 60 * 60,
    maxRequests: 5,
    action: "edit_merchant",
  },

  // 🔒 商家置顶：每小时3次
  TOP_MERCHANT: {
    windowSeconds: 60 * 60,
    maxRequests: 3,
    action: "top_merchant",
  },

  // 🔒 联系商家：每分钟10次（防止骚扰）
  CONTACT_MERCHANT: {
    windowSeconds: 60,
    maxRequests: 10,
    action: "contact_merchant",
  },

  // 🔒 举报：每小时5次
  REPORT: {
    windowSeconds: 60 * 60,
    maxRequests: 5,
    action: "report",
  },

  // 🔒 收藏：每分钟30次
  FAVORITE: {
    windowSeconds: 60,
    maxRequests: 30,
    action: "favorite",
  },

  // 🔒 邀请：每小时10次
  INVITE: {
    windowSeconds: 60 * 60,
    maxRequests: 10,
    action: "invite",
  },

  // 🔒 使用邀请码：每天5次（防止重复刷邀请奖励）
  USE_INVITATION: {
    windowSeconds: 24 * 60 * 60,
    maxRequests: 5,
    action: "use_invitation",
  },

  // 🔒 消息发送：每分钟20次
  SEND_MESSAGE: {
    windowSeconds: 60,
    maxRequests: 20,
    action: "send_message",
  },

  // 🔒 通知创建：每分钟50次
  CREATE_NOTIFICATION: {
    windowSeconds: 60,
    maxRequests: 50,
    action: "create_notification",
  },

  // 🔒 查询商家列表：每分钟60次
  GET_MERCHANTS: {
    windowSeconds: 60,
    maxRequests: 60,
    action: "get_merchants",
  },

  // 🔒 更新用户资料：每小时10次
  UPDATE_PROFILE: {
    windowSeconds: 60 * 60,
    maxRequests: 10,
    action: "update_profile",
  },

  // 🔒 系统设置更新：每小时5次（管理员）
  UPDATE_SETTINGS: {
    windowSeconds: 60 * 60,
    maxRequests: 5,
    action: "update_settings",
  },
} as const

/**
 * 便捷的速率限制检查函数
 * @param userId 用户ID
 * @param limitType 限制类型
 * @returns 是否允许请求
 */
export async function rateLimitCheck(
  userId: string,
  limitType: keyof typeof RATE_LIMITS
): Promise<RateLimitResult> {
  const config = RATE_LIMITS[limitType]
  return checkRateLimit({
    identifier: userId,
    action: config.action,
    windowSeconds: config.windowSeconds,
    maxRequests: config.maxRequests,
  })
}

/**
 * 速率限制包装器（用于包装函数）
 * @param userId 用户ID
 * @param limitType 限制类型
 * @param fn 要执行的函数
 * @returns 函数执行结果
 * @throws Error 如果超出速率限制
 */
export async function withRateLimit<T>(
  userId: string,
  limitType: keyof typeof RATE_LIMITS,
  fn: () => Promise<T>
): Promise<T> {
  const result = await rateLimitCheck(userId, limitType)

  if (!result.allowed) {
    throw new Error(
      `操作过于频繁，请在 ${result.retryAfter} 秒后重试。(${result.currentCount}/${result.limit})`
    )
  }

  return fn()
}

/**
 * 基于IP的速率限制（用于未登录用户）
 * @param ipAddress IP地址
 * @param action 操作类型
 * @param maxRequests 最大请求数
 * @param windowSeconds 时间窗口（秒）
 * @returns 限流结果
 */
export function checkIPRateLimit(
  ipAddress: string,
  action: string,
  maxRequests: number = 100,
  windowSeconds: number = 60
): RateLimitResult {
  return checkRateLimit({
    identifier: ipAddress,
    action: `ip_${action}`,
    maxRequests,
    windowSeconds,
  })
}
