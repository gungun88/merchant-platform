"use client"

import { useState, useCallback } from "react"
import Cropper from "react-easy-crop"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"

interface ImageCropperProps {
  image: string
  open: boolean
  onClose: () => void
  onCropComplete: (croppedImage: Blob) => void
  aspectRatio?: number
}

export function ImageCropper({ image, open, onClose, onCropComplete, aspectRatio = 1 }: ImageCropperProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null)

  const onCropCompleteHandler = useCallback((croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels)
  }, [])

  const handleCropConfirm = async () => {
    if (!croppedAreaPixels) return

    try {
      const croppedImage = await getCroppedImg(image, croppedAreaPixels)
      onCropComplete(croppedImage)
      onClose()
    } catch (error) {
      console.error("Error cropping image:", error)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>裁剪图片</DialogTitle>
          <p className="text-sm text-muted-foreground">按住鼠标左键拖动图片调整位置，使用滑块缩放</p>
        </DialogHeader>

        <div className="relative h-[400px] bg-gray-100 rounded-lg overflow-hidden touch-none">
          <Cropper
            image={image}
            crop={crop}
            zoom={zoom}
            aspect={aspectRatio}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropCompleteHandler}
            restrictPosition={false}
            style={{
              containerStyle: {
                width: "100%",
                height: "100%",
                backgroundColor: "#f3f4f6",
                cursor: "move",
              },
              mediaStyle: {
                cursor: "move",
              },
              cropAreaStyle: {
                border: "2px solid #fff",
                boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.5)",
                cursor: "move",
              },
            }}
          />
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">缩放 ({zoom.toFixed(1)}x)</label>
            <Slider
              value={[zoom]}
              min={0.5}
              max={3}
              step={0.1}
              onValueChange={(value) => setZoom(value[0])}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>缩小 (0.5x)</span>
              <span>放大 (3x)</span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button onClick={handleCropConfirm}>
            确认裁剪
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// 辅助函数：将裁剪区域转换为 Blob
async function getCroppedImg(imageSrc: string, pixelCrop: any): Promise<Blob> {
  const image = await createImage(imageSrc)
  const canvas = document.createElement("canvas")
  const ctx = canvas.getContext("2d")

  if (!ctx) {
    throw new Error("Failed to get canvas context")
  }

  // 设置画布大小为裁剪区域大小
  canvas.width = pixelCrop.width
  canvas.height = pixelCrop.height

  // 绘制裁剪后的图片
  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height
  )

  // 转换为 Blob (使用 PNG 格式以支持透明背景)
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob)
      } else {
        reject(new Error("Canvas is empty"))
      }
    }, "image/png")
  })
}

// 辅助函数：创建图片对象
function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.addEventListener("load", () => resolve(image))
    image.addEventListener("error", (error) => reject(error))
    image.src = url
  })
}
