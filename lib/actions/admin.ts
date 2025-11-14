"use server"

import { createClient } from "@/lib/supabase/server"
import { checkIsAdmin } from "./auth-helpers"

/**
 * 检查当前用户是否是管理员
 * @deprecated 请使用 auth-helpers.ts 中的 checkIsAdmin() 或 requireAdmin()
 */
export async function isAdmin(): Promise<boolean> {
  return checkIsAdmin()
}

/**
 * 获取当前用户的角色
 */
export async function getUserRole(): Promise<"user" | "admin" | "super_admin" | null> {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return null
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single()

    if (profileError || !profile) {
      return null
    }

    return profile.role as "user" | "admin" | "super_admin"
  } catch (error) {
    console.error("Error getting user role:", error)
    return null
  }
}

/**
 * 记录管理员操作日志
 */
export async function logAdminOperation(params: {
  operationType: string
  targetType: string
  targetId?: string
  description: string
  metadata?: Record<string, any>
}) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      throw new Error("未登录")
    }

    // 检查是否是管理员
    const adminStatus = await isAdmin()
    if (!adminStatus) {
      throw new Error("只有管理员可以执行此操作")
    }

    const { error } = await supabase.from("admin_operation_logs").insert({
      admin_id: user.id,
      operation_type: params.operationType,
      target_type: params.targetType,
      target_id: params.targetId || null,
      description: params.description,
      metadata: params.metadata || null,
    })

    if (error) throw error

    return { success: true }
  } catch (error) {
    console.error("Error logging admin operation:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "记录操作日志失败",
    }
  }
}

/**
 * 获取管理员操作日志
 */
export async function getAdminLogs(params?: {
  page?: number
  pageSize?: number
  operationType?: string
  targetType?: string
}) {
  try {
    const supabase = await createClient()

    // 检查是否是管理员
    const adminStatus = await isAdmin()
    if (!adminStatus) {
      throw new Error("只有管理员可以查看日志")
    }

    const page = params?.page || 1
    const pageSize = params?.pageSize || 50
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    let query = supabase
      .from("admin_operation_logs")
      .select("*, profiles!admin_id(username, email)", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to)

    if (params?.operationType) {
      query = query.eq("operation_type", params.operationType)
    }

    if (params?.targetType) {
      query = query.eq("target_type", params.targetType)
    }

    const { data, error, count } = await query

    if (error) throw error

    return {
      success: true,
      data: data || [],
      total: count || 0,
      page,
      pageSize,
    }
  } catch (error) {
    console.error("Error getting admin logs:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "获取日志失败",
      data: [],
      total: 0,
    }
  }
}
