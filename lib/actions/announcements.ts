"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export interface Announcement {
  id: string
  title: string
  content: string
  type: "info" | "warning" | "success" | "error" | "update"
  priority: number
  is_active: boolean
  is_pinned: boolean
  target_audience: "all" | "users" | "merchants" | "partners"
  start_date: string | null
  end_date: string | null
  click_count: number
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface CreateAnnouncementData {
  title: string
  content: string
  type: "info" | "warning" | "success" | "error" | "update"
  priority?: number
  is_active?: boolean
  is_pinned?: boolean
  target_audience?: "all" | "users" | "merchants" | "partners"
  start_date?: string
  end_date?: string
}

export interface UpdateAnnouncementData extends Partial<CreateAnnouncementData> {
  id: string
}

export interface AnnouncementStats {
  total: number
  active: number
  inactive: number
  pinned: number
}

/**
 * 获取所有公告（管理员）
 */
export async function getAllAnnouncements() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: "未登录", data: [] }
  }

  // 验证管理员权限
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  if (!profile || profile.role !== "admin") {
    return { success: false, error: "无权限访问", data: [] }
  }

  try {
    const { data: announcements, error } = await supabase
      .from("announcements")
      .select("*")
      .order("is_pinned", { ascending: false })
      .order("priority", { ascending: false })
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Error fetching announcements:", error)
      return { success: false, error: error.message, data: [] }
    }

    return { success: true, data: announcements as Announcement[] }
  } catch (error: any) {
    console.error("Error in getAllAnnouncements:", error)
    return { success: false, error: error.message, data: [] }
  }
}

/**
 * 获取激活的公告（前台显示）
 */
export async function getActiveAnnouncements(targetAudience?: "all" | "users" | "merchants" | "partners") {
  const supabase = await createClient()

  try {
    let query = supabase
      .from("announcements")
      .select("*")
      .eq("is_active", true)

    // 获取当前时间
    const now = new Date().toISOString()

    // 过滤时间范围
    query = query.or(`start_date.is.null,start_date.lte.${now}`)
    query = query.or(`end_date.is.null,end_date.gte.${now}`)

    // 如果指定了目标受众，则过滤
    if (targetAudience && targetAudience !== "all") {
      query = query.in("target_audience", ["all", targetAudience])
    } else {
      query = query.eq("target_audience", "all")
    }

    const { data: announcements, error } = await query
      .order("is_pinned", { ascending: false })
      .order("priority", { ascending: false })
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Error fetching active announcements:", error)
      return { success: false, error: error.message, data: [] }
    }

    return { success: true, data: announcements as Announcement[] }
  } catch (error: any) {
    console.error("Error in getActiveAnnouncements:", error)
    return { success: false, error: error.message, data: [] }
  }
}

/**
 * 获取公告统计数据（管理员）
 */
export async function getAnnouncementStats(): Promise<AnnouncementStats> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { total: 0, active: 0, inactive: 0, pinned: 0 }
  }

  try {
    const { data: allAnnouncements } = await supabase
      .from("announcements")
      .select("id, is_active, is_pinned")

    if (!allAnnouncements) {
      return { total: 0, active: 0, inactive: 0, pinned: 0 }
    }

    const total = allAnnouncements.length
    const active = allAnnouncements.filter((a) => a.is_active).length
    const inactive = allAnnouncements.filter((a) => !a.is_active).length
    const pinned = allAnnouncements.filter((a) => a.is_pinned).length

    return { total, active, inactive, pinned }
  } catch (error) {
    console.error("Error in getAnnouncementStats:", error)
    return { total: 0, active: 0, inactive: 0, pinned: 0 }
  }
}

/**
 * 创建公告（管理员）
 */
export async function createAnnouncement(data: CreateAnnouncementData) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: "未登录" }
  }

  // 验证管理员权限
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  if (!profile || profile.role !== "admin") {
    return { success: false, error: "无权限操作" }
  }

  if (!data.title || !data.title.trim()) {
    return { success: false, error: "请填写公告标题" }
  }

  if (!data.content || !data.content.trim()) {
    return { success: false, error: "请填写公告内容" }
  }

  try {
    const { error } = await supabase.from("announcements").insert({
      title: data.title,
      content: data.content,
      type: data.type || "info",
      priority: data.priority ?? 0,
      is_active: data.is_active ?? true,
      is_pinned: data.is_pinned ?? false,
      target_audience: data.target_audience || "all",
      start_date: data.start_date || null,
      end_date: data.end_date || null,
      created_by: user.id,
    })

    if (error) {
      console.error("Error creating announcement:", error)
      return { success: false, error: error.message }
    }

    revalidatePath("/admin/announcements")
    return { success: true }
  } catch (error: any) {
    console.error("Error in createAnnouncement:", error)
    return { success: false, error: error.message }
  }
}

/**
 * 更新公告（管理员）
 */
export async function updateAnnouncement(data: UpdateAnnouncementData) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: "未登录" }
  }

  // 验证管理员权限
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  if (!profile || profile.role !== "admin") {
    return { success: false, error: "无权限操作" }
  }

  if (!data.id) {
    return { success: false, error: "缺少公告ID" }
  }

  try {
    const updateData: any = {}

    if (data.title !== undefined) updateData.title = data.title
    if (data.content !== undefined) updateData.content = data.content
    if (data.type !== undefined) updateData.type = data.type
    if (data.priority !== undefined) updateData.priority = data.priority
    if (data.is_active !== undefined) updateData.is_active = data.is_active
    if (data.is_pinned !== undefined) updateData.is_pinned = data.is_pinned
    if (data.target_audience !== undefined) updateData.target_audience = data.target_audience
    if (data.start_date !== undefined) updateData.start_date = data.start_date || null
    if (data.end_date !== undefined) updateData.end_date = data.end_date || null

    const { error } = await supabase
      .from("announcements")
      .update(updateData)
      .eq("id", data.id)

    if (error) {
      console.error("Error updating announcement:", error)
      return { success: false, error: error.message }
    }

    revalidatePath("/admin/announcements")
    return { success: true }
  } catch (error: any) {
    console.error("Error in updateAnnouncement:", error)
    return { success: false, error: error.message }
  }
}

/**
 * 删除公告（管理员）
 */
export async function deleteAnnouncement(announcementId: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: "未登录" }
  }

  // 验证管理员权限
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  if (!profile || profile.role !== "admin") {
    return { success: false, error: "无权限操作" }
  }

  try {
    const { error } = await supabase
      .from("announcements")
      .delete()
      .eq("id", announcementId)

    if (error) {
      console.error("Error deleting announcement:", error)
      return { success: false, error: error.message }
    }

    revalidatePath("/admin/announcements")
    return { success: true }
  } catch (error: any) {
    console.error("Error in deleteAnnouncement:", error)
    return { success: false, error: error.message }
  }
}

/**
 * 增加公告点击次数
 */
export async function incrementAnnouncementClickCount(announcementId: string) {
  const supabase = await createClient()

  try {
    const { error } = await supabase.rpc("increment_announcement_clicks", {
      announcement_id: announcementId,
    })

    // 如果RPC函数不存在，使用备用方案
    if (error && error.message.includes("function") && error.message.includes("does not exist")) {
      const { data: announcement } = await supabase
        .from("announcements")
        .select("click_count")
        .eq("id", announcementId)
        .single()

      if (announcement) {
        await supabase
          .from("announcements")
          .update({ click_count: announcement.click_count + 1 })
          .eq("id", announcementId)
      }
      return { success: true }
    }

    if (error) {
      console.error("Error incrementing click count:", error)
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (error: any) {
    console.error("Error in incrementAnnouncementClickCount:", error)
    return { success: false, error: error.message }
  }
}
