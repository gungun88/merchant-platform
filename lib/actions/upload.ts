"use server"

import { createClient } from "@/lib/supabase/server"

/**
 * 上传Banner图片到Supabase Storage
 * @param file - 图片文件(base64或File对象)
 * @param fileName - 文件名
 * @returns 上传后的公开URL
 */
export async function uploadBannerImage(
  fileData: string | ArrayBuffer,
  fileName: string
): Promise<{ success: boolean; url?: string; error?: string }> {
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

    if (!profile || !["admin", "super_admin"].includes(profile.role)) {
      return { success: false, error: "权限不足,仅管理员可上传" }
    }

    // 生成唯一文件名
    const timestamp = Date.now()
    const randomStr = Math.random().toString(36).substring(2, 15)
    const ext = fileName.split(".").pop()?.toLowerCase()
    const uniqueFileName = `${timestamp}-${randomStr}.${ext}`

    // 获取正确的MIME类型
    const getMimeType = (extension: string | undefined): string => {
      switch (extension) {
        case "jpg":
        case "jpeg":
          return "image/jpeg"
        case "png":
          return "image/png"
        case "webp":
          return "image/webp"
        case "gif":
          return "image/gif"
        default:
          return "image/jpeg" // 默认使用jpeg
      }
    }

    const mimeType = getMimeType(ext)

    // 将base64转换为Blob
    let fileBlob: Blob
    if (typeof fileData === "string") {
      // base64格式
      const base64Data = fileData.split(",")[1]
      const byteCharacters = atob(base64Data)
      const byteNumbers = new Array(byteCharacters.length)
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i)
      }
      const byteArray = new Uint8Array(byteNumbers)
      fileBlob = new Blob([byteArray], { type: mimeType })
    } else {
      // ArrayBuffer格式
      fileBlob = new Blob([fileData], { type: mimeType })
    }

    // 上传到Supabase Storage
    const { data, error } = await supabase.storage
      .from("banners")
      .upload(uniqueFileName, fileBlob, {
        contentType: mimeType,
        cacheControl: "3600",
        upsert: false,
      })

    if (error) {
      console.error("Upload error:", error)
      return { success: false, error: error.message }
    }

    // 获取公开URL
    const {
      data: { publicUrl },
    } = supabase.storage.from("banners").getPublicUrl(data.path)

    return { success: true, url: publicUrl }
  } catch (error: any) {
    console.error("Error uploading banner image:", error)
    return { success: false, error: error.message }
  }
}

/**
 * 删除Banner图片
 * @param imageUrl - 图片URL
 */
export async function deleteBannerImage(
  imageUrl: string
): Promise<{ success: boolean; error?: string }> {
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

    if (!profile || !["admin", "super_admin"].includes(profile.role)) {
      return { success: false, error: "权限不足" }
    }

    // 从URL中提取文件路径
    const urlParts = imageUrl.split("/")
    const fileName = urlParts[urlParts.length - 1]

    // 删除文件
    const { error } = await supabase.storage.from("banners").remove([fileName])

    if (error) {
      console.error("Delete error:", error)
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (error: any) {
    console.error("Error deleting banner image:", error)
    return { success: false, error: error.message }
  }
}
