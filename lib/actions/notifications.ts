"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { sanitizeText, sanitizeBasicHTML } from "@/lib/utils/sanitize"

export interface Notification {
  id: string
  user_id: string
  type: string
  category: string
  title: string
  content: string | null
  related_merchant_id: string | null
  related_user_id: string | null
  metadata: any
  is_read: boolean
  read_at: string | null
  priority: string
  created_at: string
  expires_at: string | null
}

export interface GetNotificationsParams {
  page?: number
  limit?: number
  isRead?: boolean | null
  type?: string | null
}

/**
 * 获取当前用户的通知列表
 */
export async function getNotifications(params: GetNotificationsParams = {}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: "未登录" }
  }

  const page = params.page || 1
  const limit = params.limit || 20
  const offset = (page - 1) * limit

  try {
    let query = supabase
      .from("notifications")
      .select("*", { count: "exact" })
      .eq("user_id", user.id)

    // 筛选条件
    if (params.isRead !== null && params.isRead !== undefined) {
      query = query.eq("is_read", params.isRead)
    }

    if (params.type) {
      query = query.eq("type", params.type)
    }

    // 过滤已过期的通知
    query = query.or("expires_at.is.null,expires_at.gt." + new Date().toISOString())

    // 排序和分页
    query = query.order("created_at", { ascending: false }).range(offset, offset + limit - 1)

    const { data, error, count } = await query

    if (error) {
      console.error("Error fetching notifications:", error)
      return { success: false, error: error.message }
    }

    return {
      success: true,
      data: data as Notification[],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    }
  } catch (error: any) {
    console.error("Error in getNotifications:", error)
    return { success: false, error: error.message }
  }
}

/**
 * 获取未读通知数量
 */
export async function getUnreadCount() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: "未登录", count: 0 }
  }

  try {
    const { data, error } = await supabase.rpc("get_unread_notification_count", {
      p_user_id: user.id,
    })

    if (error) {
      console.error("Error getting unread count:", error)
      return { success: false, error: error.message, count: 0 }
    }

    return { success: true, count: data || 0 }
  } catch (error: any) {
    console.error("Error in getUnreadCount:", error)
    return { success: false, error: error.message, count: 0 }
  }
}

/**
 * 标记单个通知为已读
 */
export async function markNotificationAsRead(notificationId: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: "未登录" }
  }

  try {
    const { error } = await supabase
      .from("notifications")
      .update({
        is_read: true,
        read_at: new Date().toISOString(),
      })
      .eq("id", notificationId)
      .eq("user_id", user.id)

    if (error) {
      console.error("Error marking notification as read:", error)
      return { success: false, error: error.message }
    }

    revalidatePath("/notifications")
    return { success: true }
  } catch (error: any) {
    console.error("Error in markNotificationAsRead:", error)
    return { success: false, error: error.message }
  }
}

/**
 * 批量标记通知为已读
 */
export async function markNotificationsAsRead(notificationIds: string[]) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: "未登录" }
  }

  try {
    const { error } = await supabase.rpc("mark_notifications_as_read", {
      p_user_id: user.id,
      p_notification_ids: notificationIds,
    })

    if (error) {
      console.error("Error marking notifications as read:", error)
      return { success: false, error: error.message }
    }

    revalidatePath("/notifications")
    return { success: true }
  } catch (error: any) {
    console.error("Error in markNotificationsAsRead:", error)
    return { success: false, error: error.message }
  }
}

/**
 * 标记所有通知为已读
 */
export async function markAllNotificationsAsRead() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: "未登录" }
  }

  try {
    const { error } = await supabase.rpc("mark_all_notifications_as_read", {
      p_user_id: user.id,
    })

    if (error) {
      console.error("Error marking all notifications as read:", error)
      return { success: false, error: error.message }
    }

    revalidatePath("/notifications")
    return { success: true }
  } catch (error: any) {
    console.error("Error in markAllNotificationsAsRead:", error)
    return { success: false, error: error.message }
  }
}

/**
 * 删除通知
 */
export async function deleteNotification(notificationId: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: "未登录" }
  }

  try {
    const { error } = await supabase
      .from("notifications")
      .delete()
      .eq("id", notificationId)
      .eq("user_id", user.id)

    if (error) {
      console.error("Error deleting notification:", error)
      return { success: false, error: error.message }
    }

    revalidatePath("/notifications")
    return { success: true }
  } catch (error: any) {
    console.error("Error in deleteNotification:", error)
    return { success: false, error: error.message }
  }
}

/**
 * 创建通知（内部函数，供其他 actions 调用）
 */
export async function createNotification(params: {
  userId: string
  type: string
  category: string
  title: string
  content?: string
  relatedMerchantId?: string
  relatedUserId?: string
  metadata?: any
  priority?: string
  expiresAt?: string
}) {
  const supabase = await createClient()

  try {
    // 🔒 XSS防护：清理通知标题和内容
    const sanitizedTitle = sanitizeText(params.title)
    const sanitizedContent = params.content ? sanitizeBasicHTML(params.content) : null

    const { data, error } = await supabase.rpc("create_notification", {
      p_user_id: params.userId,
      p_type: params.type,
      p_category: params.category,
      p_title: sanitizedTitle,
      p_content: sanitizedContent,
      p_related_merchant_id: params.relatedMerchantId || null,
      p_related_user_id: params.relatedUserId || null,
      p_metadata: params.metadata || null,
      p_priority: params.priority || "normal",
      p_expires_at: params.expiresAt || null,
    })

    if (error) {
      console.error("Error creating notification:", error)
      return { success: false, error: error.message }
    }

    return { success: true, notificationId: data }
  } catch (error: any) {
    console.error("Error in createNotification:", error)
    return { success: false, error: error.message }
  }
}
