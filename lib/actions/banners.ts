"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import type { Banner, BannerPosition } from "@/lib/types/database"

export interface CreateBannerData {
  position: BannerPosition
  image_url: string
  link_url?: string
  sort_order?: number
  is_active?: boolean
  expires_at?: string | null
}

export interface UpdateBannerData extends Partial<CreateBannerData> {
  id: string
}

/**
 * 获取所有广告Banner
 */
export async function getAllBanners() {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from("banners")
      .select("*")
      .order("position", { ascending: true })
      .order("sort_order", { ascending: true })

    if (error) {
      console.error("Error fetching banners:", error)
      return { success: false, error: error.message, data: [] }
    }

    return { success: true, data: data as Banner[] }
  } catch (error: any) {
    console.error("Error in getAllBanners:", error)
    return { success: false, error: error.message, data: [] }
  }
}

/**
 * 获取激活的广告Banner (按位置分组)
 */
export async function getActiveBanners() {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from("banners")
      .select("*")
      .eq("is_active", true)
      .order("position", { ascending: true })
      .order("sort_order", { ascending: true })

    if (error) {
      console.error("Error fetching active banners:", error)
      return { success: false, error: error.message, data: [] }
    }

    // 按位置分组
    const grouped = {
      left: data.filter((b) => b.position === "left"),
      middle: data.filter((b) => b.position === "middle"),
      right: data.filter((b) => b.position === "right"),
    }

    return { success: true, data: grouped }
  } catch (error: any) {
    console.error("Error in getActiveBanners:", error)
    return { success: false, error: error.message, data: null }
  }
}

/**
 * 创建广告Banner
 */
export async function createBanner(data: CreateBannerData) {
  try {
    const supabase = await createClient()

    // 验证用户是否是管理员
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: "未登录" }
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single()

    if (!profile || profile.role !== "admin") {
      return { success: false, error: "权限不足" }
    }

    const { data: banner, error } = await supabase
      .from("banners")
      .insert({
        ...data,
        sort_order: data.sort_order ?? 0,
        is_active: data.is_active ?? true,
      })
      .select()
      .single()

    if (error) {
      console.error("Error creating banner:", error)
      return { success: false, error: error.message }
    }

    revalidatePath("/")
    revalidatePath("/admin/banners")

    return { success: true, data: banner }
  } catch (error: any) {
    console.error("Error in createBanner:", error)
    return { success: false, error: error.message }
  }
}

/**
 * 更新广告Banner
 */
export async function updateBanner(data: UpdateBannerData) {
  try {
    const supabase = await createClient()

    // 验证用户是否是管理员
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: "未登录" }
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single()

    if (!profile || profile.role !== "admin") {
      return { success: false, error: "权限不足" }
    }

    const { id, ...updateData } = data

    const { data: banner, error } = await supabase
      .from("banners")
      .update(updateData)
      .eq("id", id)
      .select()
      .single()

    if (error) {
      console.error("Error updating banner:", error)
      return { success: false, error: error.message }
    }

    revalidatePath("/")
    revalidatePath("/admin/banners")

    return { success: true, data: banner }
  } catch (error: any) {
    console.error("Error in updateBanner:", error)
    return { success: false, error: error.message }
  }
}

/**
 * 删除广告Banner
 */
export async function deleteBanner(id: string) {
  try {
    const supabase = await createClient()

    // 验证用户是否是管理员
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: "未登录" }
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single()

    if (!profile || profile.role !== "admin") {
      return { success: false, error: "权限不足" }
    }

    const { error } = await supabase.from("banners").delete().eq("id", id)

    if (error) {
      console.error("Error deleting banner:", error)
      return { success: false, error: error.message }
    }

    revalidatePath("/")
    revalidatePath("/admin/banners")

    return { success: true }
  } catch (error: any) {
    console.error("Error in deleteBanner:", error)
    return { success: false, error: error.message }
  }
}

/**
 * 获取Banner统计信息
 */
export async function getBannerStats() {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase.from("banners").select("position, is_active")

    if (error) {
      console.error("Error fetching banner stats:", error)
      return {
        total: 0,
        active: 0,
        inactive: 0,
        byPosition: {
          left: 0,
          middle_top: 0,
          middle_bottom: 0,
          right: 0,
        },
      }
    }

    const stats = {
      total: data.length,
      active: data.filter((b) => b.is_active).length,
      inactive: data.filter((b) => !b.is_active).length,
      byPosition: {
        left: data.filter((b) => b.position === "left").length,
        middle: data.filter((b) => b.position === "middle").length,
        right: data.filter((b) => b.position === "right").length,
      },
    }

    return stats
  } catch (error: any) {
    console.error("Error in getBannerStats:", error)
    return {
      total: 0,
      active: 0,
      inactive: 0,
      byPosition: {
        left: 0,
        middle: 0,
        right: 0,
      },
    }
  }
}

/**
 * 禁用过期的广告Banner
 */
export async function disableExpiredBanners() {
  try {
    const supabase = await createClient()

    const { error } = await supabase.rpc('disable_expired_banners')

    if (error) {
      console.error("Error disabling expired banners:", error)
      return { success: false, error: error.message }
    }

    revalidatePath("/")
    revalidatePath("/admin/banners")

    return { success: true }
  } catch (error: any) {
    console.error("Error in disableExpiredBanners:", error)
    return { success: false, error: error.message }
  }
}
