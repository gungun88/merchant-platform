"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { AlertCircle, Upload, X, Image as ImageIcon } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"

interface ReportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  merchantId: string
  merchantName: string
}

const reportReasons = [
  { value: "欺诈", label: "欺诈" },
  { value: "虚假宣传", label: "虚假宣传" },
  { value: "服务态度差", label: "服务态度差" },
  { value: "质量问题", label: "质量问题" },
  { value: "其他", label: "其他" },
]

export function ReportDialog({ open, onOpenChange, merchantId, merchantName }: ReportDialogProps) {
  const [reason, setReason] = useState("")
  const [details, setDetails] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [evidenceFiles, setEvidenceFiles] = useState<File[]>([])
  const [evidenceUrls, setEvidenceUrls] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    const validFiles = files.filter(file => {
      const isImage = file.type.startsWith('image/')
      const isValidSize = file.size <= 5 * 1024 * 1024
      if (!isImage) {
        toast.error(`${file.name} 不是图片文件`)
        return false
      }
      if (!isValidSize) {
        toast.error(`${file.name} 大小超过5MB`)
        return false
      }
      return true
    })
    const totalFiles = evidenceFiles.length + validFiles.length
    if (totalFiles > 5) {
      toast.error("最多只能上传5张图片")
      return
    }
    setEvidenceFiles([...evidenceFiles, ...validFiles])
  }

  const removeFile = (index: number) => {
    setEvidenceFiles(evidenceFiles.filter((_, i) => i !== index))
  }

  const uploadEvidence = async () => {
    if (evidenceFiles.length === 0) return []
    setUploading(true)
    const uploadedUrls: string[] = []
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("用户未登录")
      for (const file of evidenceFiles) {
        const fileExt = file.name.split('.').pop()
        const fileName = `${user.id}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`
        const filePath = `report-evidence/${fileName}`
        const { data, error } = await supabase.storage
          .from('merchant-assets')
          .upload(filePath, file, { cacheControl: '3600', upsert: false })
        if (error) throw error
        const { data: { publicUrl } } = supabase.storage.from('merchant-assets').getPublicUrl(filePath)
        uploadedUrls.push(publicUrl)
      }
      return uploadedUrls
    } catch (error) {
      console.error('上传证据失败:', error)
      throw error
    } finally {
      setUploading(false)
    }
  }

  const handleSubmit = async () => {
    if (!reason) {
      toast.error("请选择举报原因")
      return
    }
    if (!details.trim()) {
      toast.error("请填写详细说明")
      return
    }
    if (evidenceFiles.length === 0) {
      toast.error("请至少上传一张证据图片")
      return
    }
    setSubmitting(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        toast.error("请先登录")
        setSubmitting(false)
        return
      }
      const uploadedUrls = await uploadEvidence()
      const { error } = await supabase.from("reports").insert({
        merchant_id: merchantId,
        reporter_id: user.id,
        // 新字段
        report_type: reason,
        report_reason: details,
        evidence_urls: uploadedUrls,
        // 旧字段（为了兼容数据库约束）
        reason: reason,
        details: details,
        status: "pending",
      })
      if (error) throw error
      toast.success("举报已提交，我们会尽快处理")
      onOpenChange(false)
      setReason("")
      setDetails("")
      setEvidenceFiles([])
      setEvidenceUrls([])
    } catch (error) {
      console.error("举报失败:", error)
      toast.error("举报提交失败，请稍后重试")
    } finally {
      setSubmitting(false)
    }
  }

  const handleClose = () => {
    setReason("")
    setDetails("")
    setEvidenceFiles([])
    setEvidenceUrls([])
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>举报商家</DialogTitle>
          <DialogDescription>举报商家：{merchantName}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-md border border-amber-200">
            <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-800">
              <p className="font-medium mb-1">举报须知</p>
              <p className="text-xs">请如实填写举报信息，我们会认真核实并处理。恶意举报将被记录并可能受到处罚。</p>
            </div>
          </div>
          <div className="space-y-3">
            <Label>举报原因 *</Label>
            <RadioGroup value={reason} onValueChange={setReason}>
              {reportReasons.map((item) => (
                <div key={item.value} className="flex items-center space-x-2">
                  <RadioGroupItem value={item.value} id={item.value} />
                  <Label htmlFor={item.value} className="cursor-pointer font-normal">{item.label}</Label>
                </div>
              ))}
            </RadioGroup>
          </div>
          <div className="space-y-3">
            <Label htmlFor="details">详细说明 *</Label>
            <Textarea id="details" value={details} onChange={(e) => setDetails(e.target.value)} placeholder="请详细说明举报原因，提供相关证据或线索..." rows={5} maxLength={500} />
            <p className="text-xs text-muted-foreground text-right">{details.length}/500</p>
          </div>
          <div className="space-y-3">
            <Label>上传证据图片 <span className="text-red-500">*</span></Label>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" onClick={() => document.getElementById('evidence-upload')?.click()} disabled={evidenceFiles.length >= 5 || uploading} className="w-full">
                  <Upload className="h-4 w-4 mr-2" />选择图片 ({evidenceFiles.length}/5)
                </Button>
                <input id="evidence-upload" type="file" accept="image/*" multiple onChange={handleFileChange} className="hidden" />
              </div>
              <p className="text-xs text-muted-foreground">支持 JPG、PNG、GIF 格式，单张图片不超过 5MB，最多上传 5 张</p>
              {evidenceFiles.length > 0 && (
                <div className="grid grid-cols-3 gap-2 mt-3">
                  {evidenceFiles.map((file, index) => (
                    <div key={index} className="relative group">
                      <div className="aspect-square rounded-lg border-2 border-dashed border-gray-300 overflow-hidden bg-gray-50">
                        <img src={URL.createObjectURL(file)} alt={`证据 ${index + 1}`} className="w-full h-full object-cover" />
                      </div>
                      <button type="button" onClick={() => removeFile(index)} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <X className="h-3 w-3" />
                      </button>
                      <p className="text-xs text-center mt-1 truncate">{file.name}</p>
                    </div>
                  ))}
                </div>
              )}
              {evidenceFiles.length === 0 && (
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                  <ImageIcon className="h-12 w-12 mx-auto text-gray-400 mb-2" />
                  <p className="text-sm text-gray-500">请上传至少一张证据图片</p>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={handleClose} disabled={submitting || uploading}>取消</Button>
          <Button onClick={handleSubmit} disabled={submitting || uploading || evidenceFiles.length === 0}>
            {submitting ? "提交中..." : uploading ? "上传中..." : "提交举报"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
