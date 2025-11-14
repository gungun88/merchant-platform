import { createClient } from "@/lib/supabase/client"

export interface LogActionParams {
  actionType: string
  targetType?: string
  targetId?: string
  oldData?: any
  newData?: any
  description?: string
}

/**
 * 记录管理员操作日志
 *
 * @param params - 日志参数
 * @param params.actionType - 操作类型,如: user_ban, merchant_approve等
 * @param params.targetType - 目标类型,如: user, merchant等
 * @param params.targetId - 目标ID
 * @param params.oldData - 操作前的数据
 * @param params.newData - 操作后的数据
 * @param params.description - 操作描述
 *
 * @example
 * ```ts
 * await logAdminAction({
 *   actionType: "user_ban",
 *   targetType: "user",
 *   targetId: userId,
 *   oldData: { is_banned: false },
 *   newData: { is_banned: true, ban_reason: "违规操作" },
 *   description: "封禁用户:违规发布商家信息"
 * })
 * ```
 */
export async function logAdminAction(params: LogActionParams) {
  try {
    const supabase = createClient()

    // 获取当前管理员信息
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      console.error("未找到当前用户,无法记录日志")
      return { success: false, error: "未找到当前用户" }
    }

    // 获取IP地址和User Agent (客户端环境)
    const ipAddress = null // 客户端无法直接获取真实IP
    const userAgent = typeof window !== "undefined" ? window.navigator.userAgent : null

    // 插入日志记录
    const { error } = await supabase.from("admin_logs").insert({
      admin_id: user.id,
      action_type: params.actionType,
      target_type: params.targetType || null,
      target_id: params.targetId || null,
      old_data: params.oldData || null,
      new_data: params.newData || null,
      description: params.description || null,
      ip_address: ipAddress,
      user_agent: userAgent,
    })

    if (error) {
      console.error("记录日志失败:", error)
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (error) {
    console.error("记录日志时发生异常:", error)
    return { success: false, error: String(error) }
  }
}

/**
 * 操作类型常量
 */
export const LOG_ACTION_TYPES = {
  // 用户相关
  USER_BAN: "user_ban",
  USER_UNBAN: "user_unban",

  // 商家相关
  MERCHANT_APPROVE: "merchant_approve",
  MERCHANT_REJECT: "merchant_reject",
  MERCHANT_UPDATE: "merchant_update",
  MERCHANT_DELETE: "merchant_delete",

  // 押金相关
  DEPOSIT_APPROVE: "deposit_approve",
  DEPOSIT_REJECT: "deposit_reject",
  REFUND_APPROVE: "refund_approve",
  REFUND_REJECT: "refund_reject",

  // 举报相关
  REPORT_HANDLE: "report_handle",
  REPORT_APPROVE: "report_approve",
  REPORT_REJECT: "report_reject",

  // 合作伙伴相关
  PARTNER_APPROVE: "partner_approve",
  PARTNER_REJECT: "partner_reject",
  PARTNER_UPDATE: "partner_update",

  // 公告相关
  ANNOUNCEMENT_CREATE: "announcement_create",
  ANNOUNCEMENT_UPDATE: "announcement_update",
  ANNOUNCEMENT_DELETE: "announcement_delete",

  // 系统设置相关
  SETTINGS_UPDATE: "settings_update",
} as const

/**
 * 目标类型常量
 */
export const LOG_TARGET_TYPES = {
  USER: "user",
  MERCHANT: "merchant",
  DEPOSIT_APPLICATION: "deposit_application",
  REFUND_APPLICATION: "refund_application",
  REPORT: "report",
  PARTNER: "partner",
  ANNOUNCEMENT: "announcement",
  SETTINGS: "settings",
} as const
