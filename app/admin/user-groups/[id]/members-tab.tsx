'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Plus, UserMinus, Mail, Upload } from 'lucide-react'
import { getGroupMembers, addGroupMember, removeGroupMember, batchAddGroupMembers } from '@/lib/actions/user-groups'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface MembersTabProps {
  groupId: string
  onUpdate: () => void
}

export function MembersTab({ groupId, onUpdate }: MembersTabProps) {
  const [members, setMembers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showBatchDialog, setShowBatchDialog] = useState(false)
  const [email, setEmail] = useState('')
  const [batchEmails, setBatchEmails] = useState('')
  const [adding, setAdding] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)

  const loadMembers = async () => {
    try {
      setLoading(true)
      const data = await getGroupMembers(groupId)
      setMembers(data)
    } catch (error: any) {
      toast.error('加载失败', { description: error.message })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadMembers()
  }, [groupId])

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return

    try {
      setAdding(true)
      await addGroupMember(groupId, email.trim())
      toast.success('添加成功', { description: `已添加 ${email}` })
      setEmail('')
      setShowAddDialog(false)
      loadMembers()
      onUpdate()
    } catch (error: any) {
      toast.error('添加失败', { description: error.message })
    } finally {
      setAdding(false)
    }
  }

  const handleBatchAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!batchEmails.trim()) return

    const emails = batchEmails
      .split('\n')
      .map((e) => e.trim())
      .filter((e) => e.length > 0)

    if (emails.length === 0) {
      toast.error('请输入至少一个邮箱')
      return
    }

    try {
      setAdding(true)
      const result = await batchAddGroupMembers(groupId, emails)

      if (result.success.length > 0) {
        toast.success('批量添加完成', {
          description: `成功: ${result.success.length}个, 失败: ${result.failed.length}个`
        })
      }

      if (result.failed.length > 0) {
        const failedList = result.failed
          .slice(0, 5)
          .map((f) => `${f.email}: ${f.reason}`)
          .join('\n')
        toast.warning('部分添加失败', { description: failedList })
      }

      setBatchEmails('')
      setShowBatchDialog(false)
      loadMembers()
      onUpdate()
    } catch (error: any) {
      toast.error('批量添加失败', { description: error.message })
    } finally {
      setAdding(false)
    }
  }

  const handleRemoveMember = async (memberId: string, email: string) => {
    try {
      await removeGroupMember(memberId)
      toast.success('移除成功', { description: `已移除 ${email}` })
      setRemovingId(null)
      loadMembers()
      onUpdate()
    } catch (error: any) {
      toast.error('移除失败', { description: error.message })
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>组成员</CardTitle>
              <CardDescription>管理用户组成员,只有组内成员才会收到定期积分</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowBatchDialog(true)}>
                <Upload className="mr-2 h-4 w-4" />
                批量添加
              </Button>
              <Button onClick={() => setShowAddDialog(true)}>
                <Plus className="mr-2 h-4 w-4" />
                添加成员
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">加载中...</div>
          ) : members.length === 0 ? (
            <div className="text-center py-8">
              <Mail className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">还没有成员</p>
              <Button variant="outline" className="mt-4" onClick={() => setShowAddDialog(true)}>
                添加第一个成员
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      {member.profiles?.avatar ? (
                        <img
                          src={member.profiles.avatar}
                          alt={member.profiles.username || member.profiles.email}
                          className="h-10 w-10 rounded-full"
                        />
                      ) : (
                        <span className="text-sm font-semibold">
                          {(member.profiles?.username || member.profiles?.email || '?')[0].toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div>
                      <div className="font-medium">
                        {member.profiles?.username || '未设置用户名'}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {member.profiles?.email}
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setRemovingId(member.id)}
                  >
                    <UserMinus className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Member Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <form onSubmit={handleAddMember}>
            <DialogHeader>
              <DialogTitle>添加成员</DialogTitle>
              <DialogDescription>
                输入用户的邮箱地址来添加成员
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="email">用户邮箱 *</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="user@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowAddDialog(false)}
                disabled={adding}
              >
                取消
              </Button>
              <Button type="submit" disabled={adding}>
                {adding ? '添加中...' : '添加'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Batch Add Dialog */}
      <Dialog open={showBatchDialog} onOpenChange={setShowBatchDialog}>
        <DialogContent className="max-w-2xl">
          <form onSubmit={handleBatchAdd}>
            <DialogHeader>
              <DialogTitle>批量添加成员</DialogTitle>
              <DialogDescription>
                每行输入一个邮箱地址,系统会自动添加所有有效的用户
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="batch-emails">用户邮箱列表 *</Label>
                <Textarea
                  id="batch-emails"
                  placeholder="user1@example.com&#10;user2@example.com&#10;user3@example.com"
                  value={batchEmails}
                  onChange={(e) => setBatchEmails(e.target.value)}
                  rows={10}
                  required
                />
                <p className="text-sm text-muted-foreground">
                  已输入 {batchEmails.split('\n').filter((e) => e.trim()).length} 个邮箱
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowBatchDialog(false)}
                disabled={adding}
              >
                取消
              </Button>
              <Button type="submit" disabled={adding}>
                {adding ? '添加中...' : '批量添加'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Remove Confirmation Dialog */}
      <AlertDialog open={removingId !== null} onOpenChange={() => setRemovingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认移除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要将此用户移出用户组吗? 移除后该用户将不再收到定期积分发放。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const member = members.find((m) => m.id === removingId)
                if (member) {
                  handleRemoveMember(member.id, member.profiles?.email)
                }
              }}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              确认移除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
