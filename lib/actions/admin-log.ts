"use server"

import { createClient } from "@/lib/supabase/server"
import { headers } from "next/headers"

export interface LogActionParams {
  actionType: string
  targetType?: string
  targetId?: string
  oldData?: any
  newData?: any
  description?: string
}

/**
 * 记录管理员操作日志（服务端版本）
 */
export async function createAdminLog(params: LogActionParams) {
  try {
    const supabase = await createClient()

    // 获取当前管理员信息
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      console.error("未找到当前用户，无法记录日志")
      return { success: false, error: "未找到当前用户" }
    }

    // 获取IP地址和User Agent（服务端环境）
    const headersList = headers()
    const ipAddress = headersList.get("x-forwarded-for") || headersList.get("x-real-ip") || null
    const userAgent = headersList.get("user-agent") || null

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

