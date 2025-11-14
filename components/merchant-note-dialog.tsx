"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { StickyNote } from "lucide-react"
import { toast } from "sonner"
import { getMerchantNote, saveMerchantNote } from "@/lib/actions/merchant-notes"

interface MerchantNoteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  merchantId: string
  merchantName: string
  onNoteUpdated?: () => void
}

export function MerchantNoteDialog({
  open,
  onOpenChange,
  merchantId,
  merchantName,
  onNoteUpdated,
}: MerchantNoteDialogProps) {
  const [note, setNote] = useState("")
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)

  useEffect(() => {
    if (open) {
      loadNote()
    }
  }, [open, merchantId])

  const loadNote = async () => {
    setInitialLoading(true)
    const result = await getMerchantNote(merchantId)
    if (result.success && result.data) {
      setNote(result.data.note || "")
    } else {
      setNote("")
    }
    setInitialLoading(false)
  }

  const handleSave = async () => {
    setLoading(true)
    try {
      const result = await saveMerchantNote(merchantId, note)
      if (result.success) {
        if (note.trim()) {
          toast.success("备注保存成功")
        } else {
          toast.success("备注已删除")
        }
        onNoteUpdated?.()
        onOpenChange(false)
      } else {
        toast.error(result.error || "保存失败")
      }
    } catch (error) {
      console.error("保存备注异常:", error)
      toast.error(`保存失败: ${error instanceof Error ? error.message : "未知错误"}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <StickyNote className="h-5 w-5" />
            商家备注
          </DialogTitle>
          <DialogDescription>为 {merchantName} 添加私人备注，仅自己可见</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="note">备注内容</Label>
            {initialLoading ? (
              <div className="text-sm text-muted-foreground py-4 text-center">加载中...</div>
            ) : (
              <>
                <Textarea
                  id="note"
                  value={note}
                  onChange={(e) => setNote(e.target.value.slice(0, 200))}
                  placeholder="例如：价格实惠、服务好、响应快..."
                  rows={5}
                  maxLength={200}
                  className="resize-none"
                />
                <div className="flex justify-between items-center">
                  <p className="text-xs text-muted-foreground">
                    {note.length}/200 字符
                  </p>
                  {note.trim() && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setNote("")}
                      className="text-xs h-auto py-1"
                    >
                      清空
                    </Button>
                  )}
                </div>
              </>
            )}
          </div>

          <div className="flex gap-2">
            <Button onClick={handleSave} disabled={loading || initialLoading} className="flex-1">
              {loading ? "保存中..." : "保存备注"}
            </Button>
            <Button onClick={() => onOpenChange(false)} variant="outline" className="flex-1">
              取消
            </Button>
          </div>

          <div className="border-t pt-4">
            <p className="text-xs text-muted-foreground">
              💡 备注仅自己可见，可用于记录商家特点、价格、服务质量等信息
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
