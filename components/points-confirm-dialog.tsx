"use client"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Coins, AlertTriangle } from "lucide-react"

interface PointsConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  points: number
  title?: string
  description?: string
  currentPoints?: number
}

export function PointsConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  points,
  title = "确认操作",
  description,
  currentPoints,
}: PointsConfirmDialogProps) {
  const hasEnoughPoints = currentPoints !== undefined ? currentPoints >= points : true

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Coins className="h-5 w-5 text-yellow-500" />
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-3">
            {description && <p>{description}</p>}

            <div className="bg-muted p-4 rounded-lg space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-foreground font-medium">扣除积分：</span>
                <span className="text-lg font-bold text-red-600">-{points} 积分</span>
              </div>

              {currentPoints !== undefined && (
                <>
                  <div className="flex items-center justify-between text-sm">
                    <span>当前积分：</span>
                    <span className="font-medium">{currentPoints} 积分</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span>操作后余额：</span>
                    <span className={`font-medium ${hasEnoughPoints ? 'text-green-600' : 'text-red-600'}`}>
                      {hasEnoughPoints ? currentPoints - points : 0} 积分
                    </span>
                  </div>
                </>
              )}
            </div>

            {!hasEnoughPoints && (
              <div className="flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-lg">
                <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                <span className="text-sm font-medium">积分不足，无法完成此操作</span>
              </div>
            )}

            <p className="text-sm text-muted-foreground">
              {hasEnoughPoints ? '确认后将立即扣除积分，是否继续？' : '请先通过签到或其他方式获取积分。'}
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>取消</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} disabled={!hasEnoughPoints}>
            确认操作
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
