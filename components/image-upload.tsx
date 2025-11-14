"use client"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { Upload, X, Loader2 } from "lucide-react"

interface ImageUploadProps {
  currentImage?: string
  onImageChange: (imageUrl: string) => void
  folder?: string
  maxSize?: number // MB
  fallbackText?: string
}

export function ImageUpload({
  currentImage,
  onImageChange,
  folder = "merchant-logos",
  maxSize = 2,
  fallbackText = "上传",
}: ImageUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState<string>(currentImage || "")
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // 验证文件类型
    if (!file.type.startsWith("image/")) {
      toast.error("请上传图片文件")
      return
    }

    // 验证文件大小
    if (file.size > maxSize * 1024 * 1024) {
      toast.error(`图片大小不能超过 ${maxSize}MB`)
      return
    }

    setUploading(true)

    try {
      const supabase = createClient()

      // 获取当前用户
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        toast.error("请先登录")
        return
      }

      // 生成唯一文件名
      const fileExt = file.name.split(".").pop()
      const fileName = `${user.id}-${Date.now()}.${fileExt}`
      const filePath = `${folder}/${fileName}`

      // 上传到 Supabase Storage
      const { data, error } = await supabase.storage.from("merchant-assets").upload(filePath, file, {
        cacheControl: "3600",
        upsert: false,
      })

      if (error) {
        console.error("Upload error:", error)
        toast.error("上传失败：" + error.message)
        return
      }

      // 获取公开URL
      const {
        data: { publicUrl },
      } = supabase.storage.from("merchant-assets").getPublicUrl(filePath)

      setPreview(publicUrl)
      onImageChange(publicUrl)
      toast.success("上传成功")
    } catch (error) {
      console.error("Upload error:", error)
      toast.error("上传失败")
    } finally {
      setUploading(false)
    }
  }

  const handleRemove = () => {
    setPreview("")
    onImageChange("")
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const handleClick = () => {
    fileInputRef.current?.click()
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4">
        <Avatar className="h-20 w-20">
          {preview ? (
            <AvatarImage src={preview} alt="预览" />
          ) : (
            <AvatarFallback className="text-2xl">{fallbackText[0]}</AvatarFallback>
          )}
        </Avatar>

        <div className="flex gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
            disabled={uploading}
          />

          <Button type="button" variant="outline" size="sm" onClick={handleClick} disabled={uploading}>
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                上传中...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                {preview ? "更换图片" : "上传图片"}
              </>
            )}
          </Button>

          {preview && !uploading && (
            <Button type="button" variant="outline" size="sm" onClick={handleRemove}>
              <X className="h-4 w-4 mr-2" />
              移除
            </Button>
          )}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        支持 JPG、PNG、GIF 格式，大小不超过 {maxSize}MB
      </p>
    </div>
  )
}
