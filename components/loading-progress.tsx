"use client"

import { useEffect, useState } from "react"
import { Progress } from "@/components/ui/progress"

interface LoadingProgressProps {
  /** 是否显示加载进度 */
  isLoading?: boolean
  /** 加载提示文字 */
  message?: string
  /** 自定义进度值（0-100），如果不提供则自动模拟进度 */
  progress?: number
}

export function LoadingProgress({
  isLoading = true,
  message = "正在加载数据...",
  progress: customProgress,
}: LoadingProgressProps) {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    if (!isLoading) {
      setProgress(100)
      return
    }

    // 如果提供了自定义进度，使用自定义进度
    if (customProgress !== undefined) {
      setProgress(customProgress)
      return
    }

    // 自动模拟进度增长
    setProgress(0)

    // 快速增长到 60%
    const timer1 = setTimeout(() => setProgress(30), 100)
    const timer2 = setTimeout(() => setProgress(50), 300)
    const timer3 = setTimeout(() => setProgress(70), 600)
    const timer4 = setTimeout(() => setProgress(85), 1000)

    // 在 85% 后缓慢增长，等待实际数据加载完成
    const slowProgress = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 95) return prev // 最多到 95%，留给实际加载完成时跳到 100%
        return prev + 1
      })
    }, 800)

    return () => {
      clearTimeout(timer1)
      clearTimeout(timer2)
      clearTimeout(timer3)
      clearTimeout(timer4)
      clearInterval(slowProgress)
    }
  }, [isLoading, customProgress])

  if (!isLoading && progress === 100) {
    return null
  }

  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="w-full max-w-md space-y-4">
        {/* 进度条 */}
        <Progress value={progress} className="h-2" />

        {/* 百分比和提示文字 */}
        <div className="text-center space-y-1">
          <p className="text-2xl font-semibold text-primary">
            {Math.round(progress)}%
          </p>
          <p className="text-sm text-muted-foreground">{message}</p>
        </div>
      </div>
    </div>
  )
}
