"use client"

import { useEffect, useState } from "react"
import { AdminLayout } from "@/components/admin-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Plus, Copy, Download, RefreshCw, Trash2 } from "lucide-react"
import { format } from "date-fns"
import { zhCN } from "date-fns/locale"
import { toast } from "sonner"
import {
  getBetaCodes,
  generateBatchBetaCodes,
  deleteBetaCode,
  deleteBatchBetaCodes,
  type BetaCode,
} from "@/lib/actions/beta-codes"

export default function BetaCodesPage() {
  const [betaCodes, setBetaCodes] = useState<BetaCode[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  // 对话框状态
  const [batchDialogOpen, setBatchDialogOpen] = useState(false)
  const [batchCount, setBatchCount] = useState("50")

  useEffect(() => {
    loadBetaCodes()
  }, [])

  const loadBetaCodes = async () => {
    setLoading(true)
    const result = await getBetaCodes()
    if (result.success) {
      setBetaCodes(result.data)
    } else {
      toast.error(result.error || "加载失败")
    }
    setLoading(false)
  }

  const handleBatchGenerate = async () => {
    const count = parseInt(batchCount)
    if (count < 1 || count > 500) {
      toast.error("批量生成数量必须在1-500之间")
      return
    }

    const result = await generateBatchBetaCodes(count)

    if (result.success) {
      toast.success(`成功生成 ${result.data.length} 个内测码`)
      setBatchDialogOpen(false)
      setBatchCount("50")
      loadBetaCodes()
    } else {
      toast.error(result.error || "批量生成失败")
    }
  }

  const handleDelete = async (betaCode: BetaCode) => {
    if (!confirm(`确定要删除内测码 "${betaCode.code}" 吗？`)) {
      return
    }

    const result = await deleteBetaCode(betaCode.id)

    if (result.success) {
      toast.success("删除成功")
      loadBetaCodes()
    } else {
      toast.error(result.error || "删除失败")
    }
  }

  const handleBatchDelete = async () => {
    if (selectedIds.length === 0) {
      toast.error("请先选择要删除的内测码")
      return
    }

    if (!confirm(`确定要删除选中的 ${selectedIds.length} 个内测码吗？`)) {
      return
    }

    const result = await deleteBatchBetaCodes(selectedIds)

    if (result.success) {
      toast.success(`成功删除 ${selectedIds.length} 个内测码`)
      setSelectedIds([])
      loadBetaCodes()
    } else {
      toast.error(result.error || "批量删除失败")
    }
  }

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code)
    toast.success("已复制到剪贴板")
  }

  const handleCopyAllUnused = () => {
    const unusedCodes = filteredBetaCodes
      .filter(bc => !bc.is_used)
      .map(bc => bc.code)
      .join('\n')

    if (unusedCodes) {
      navigator.clipboard.writeText(unusedCodes)
      toast.success(`已复制 ${unusedCodes.split('\n').length} 个未使用的内测码`)
    } else {
      toast.error("没有未使用的内测码")
    }
  }

  const handleExportCodes = () => {
    const csvContent = [
      ["内测码", "状态", "使用者", "使用时间", "创建时间"].join(","),
      ...filteredBetaCodes.map((bc) => [
        bc.code,
        bc.is_used ? "已使用" : "未使用",
        bc.user?.username || "-",
        bc.used_at ? format(new Date(bc.used_at), "yyyy-MM-dd HH:mm:ss", { locale: zhCN }) : "-",
        format(new Date(bc.created_at), "yyyy-MM-dd HH:mm:ss", { locale: zhCN }),
      ].join(",")),
    ].join("\n")

    const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    link.href = URL.createObjectURL(blob)
    link.download = `内测码_${format(new Date(), "yyyyMMdd_HHmmss")}.csv`
    link.click()
    toast.success("导出成功")
  }

  const filteredBetaCodes = betaCodes.filter((bc) =>
    bc.code.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const stats = {
    total: betaCodes.length,
    unused: betaCodes.filter((bc) => !bc.is_used).length,
    used: betaCodes.filter((bc) => bc.is_used).length,
  }

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredBetaCodes.length) {
      setSelectedIds([])
    } else {
      setSelectedIds(filteredBetaCodes.map(bc => bc.id))
    }
  }

  const toggleSelect = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(selectedId => selectedId !== id))
    } else {
      setSelectedIds([...selectedIds, id])
    }
  }

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        {/* 页面标题 */}
        <div>
          <h1 className="text-3xl font-bold">内测邀请码管理</h1>
          <p className="text-muted-foreground mt-1">批量生成内测邀请码，每个码只能使用一次</p>
        </div>

        {/* 统计卡片 */}
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                总内测码数
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                未使用
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.unused}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                已使用
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{stats.used}</div>
            </CardContent>
          </Card>
        </div>

        {/* 内测码列表 */}
        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <CardTitle>内测码列表</CardTitle>
              <div className="flex items-center gap-2">
                <Input
                  placeholder="搜索内测码..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-[200px]"
                />
                {selectedIds.length > 0 && (
                  <Button variant="destructive" size="sm" onClick={handleBatchDelete}>
                    删除选中 ({selectedIds.length})
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={handleCopyAllUnused}>
                  <Copy className="h-4 w-4 mr-1" />
                  复制未使用
                </Button>
                <Button variant="outline" size="sm" onClick={handleExportCodes}>
                  <Download className="h-4 w-4 mr-1" />
                  导出
                </Button>
                <Button variant="outline" size="sm" onClick={loadBetaCodes}>
                  <RefreshCw className="h-4 w-4 mr-1" />
                  刷新
                </Button>
                <Button size="sm" onClick={() => setBatchDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-1" />
                  批量生成
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">加载中...</div>
            ) : filteredBetaCodes.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {searchTerm ? "没有找到匹配的内测码" : "暂无内测码，点击上方按钮批量生成"}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox
                          checked={selectedIds.length === filteredBetaCodes.length && filteredBetaCodes.length > 0}
                          onCheckedChange={toggleSelectAll}
                        />
                      </TableHead>
                      <TableHead>内测码</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead>使用者</TableHead>
                      <TableHead>使用时间</TableHead>
                      <TableHead>创建时间</TableHead>
                      <TableHead className="text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredBetaCodes.map((betaCode) => (
                      <TableRow key={betaCode.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedIds.includes(betaCode.id)}
                            onCheckedChange={() => toggleSelect(betaCode.id)}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-lg">{betaCode.code}</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={() => handleCopyCode(betaCode.code)}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell>
                          {betaCode.is_used ? (
                            <Badge variant="secondary">已使用</Badge>
                          ) : (
                            <Badge variant="default">未使用</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {betaCode.user ? (
                            <div className="flex flex-col">
                              <span className="font-medium">{betaCode.user.username}</span>
                              <span className="text-xs text-muted-foreground">
                                NO.{betaCode.user.user_number}
                              </span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">
                            {betaCode.used_at
                              ? format(new Date(betaCode.used_at), "yyyy-MM-dd HH:mm:ss", { locale: zhCN })
                              : "-"}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">
                            {format(new Date(betaCode.created_at), "yyyy-MM-dd HH:mm:ss", { locale: zhCN })}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              onClick={() => handleDelete(betaCode)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 批量生成对话框 */}
      <Dialog open={batchDialogOpen} onOpenChange={setBatchDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>批量生成内测码</DialogTitle>
            <DialogDescription>
              一次生成多个内测码，系统将自动生成唯一的8位内测码（每个码只能使用一次）
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="count">生成数量</Label>
              <Input
                id="count"
                type="number"
                min="1"
                max="500"
                placeholder="1-500"
                value={batchCount}
                onChange={(e) => setBatchCount(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">一次最多生成500个</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBatchDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleBatchGenerate}>生成</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  )
}
