"use server"

import { createClient } from "@/lib/supabase/server"

/**
 * 统一的管理员权限验证
 * Unified admin permission validation
 *
 * @throws Error if user is not authenticated or not an admin
 * @returns Object containing user, profile, and admin role information
 */
export async function requireAdmin() {
  const supabase = await createClient()

  // 1. 验证用户登录状态
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error("请先登录")
  }

  // 2. 获取用户角色
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role, username, id")
    .eq("id", user.id)
    .single()

  if (profileError || !profile) {
    throw new Error("无法获取用户信息")
  }

  // 3. 验证管理员权限
  const isAdmin = profile.role === "admin" || profile.role === "super_admin"
  const isSuperAdmin = profile.role === "super_admin"

  if (!isAdmin) {
    throw new Error("只有管理员可以执行此操作")
  }

  // 4. 返回完整的认证信息
  return {
    user,
    profile,
    isAdmin,
    isSuperAdmin,
    userId: user.id,
    role: profile.role,
  }
}

/**
 * 验证是否为超级管理员
 * Check if user is super admin
 *
 * @throws Error if user is not a super admin
 */
export async function requireSuperAdmin() {
  const auth = await requireAdmin()

  if (!auth.isSuperAdmin) {
    throw new Error("只有超级管理员可以执行此操作")
  }

  return auth
}

/**
 * 检查用户是否为管理员（不抛出错误）
 * Check if user is admin without throwing error
 *
 * @returns boolean indicating if user is admin
 */
export async function checkIsAdmin(): Promise<boolean> {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return false

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single()

    if (!profile) return false

    return profile.role === "admin" || profile.role === "super_admin"
  } catch (error) {
    return false
  }
}

/**
 * 验证资源所有权或管理员权限
 * Verify resource ownership or admin permission
 *
 * @param resourceUserId - The user ID that owns the resource
 * @throws Error if user doesn't own the resource and is not an admin
 */
export async function requireOwnershipOrAdmin(resourceUserId: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error("请先登录")
  }

  // 如果是资源所有者，直接返回
  if (user.id === resourceUserId) {
    return {
      user,
      isOwner: true,
      isAdmin: false,
    }
  }

  // 否则检查是否为管理员
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  const isAdmin = profile?.role === "admin" || profile?.role === "super_admin"

  if (!isAdmin) {
    throw new Error("无权限执行此操作")
  }

  return {
    user,
    isOwner: false,
    isAdmin: true,
  }
}
