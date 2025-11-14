"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { X, Plus, AlertCircle } from "lucide-react"
import { toast } from "sonner"
import { addSensitiveWord, removeSensitiveWord } from "@/lib/actions/settings"

interface SensitiveWordsManagerProps {
  initialWords: string[]
  onUpdate?: () => void
}

export function SensitiveWordsManager({
  initialWords,
  onUpdate,
}: SensitiveWordsManagerProps) {
  const [words, setWords] = useState<string[]>(initialWords || [])
  const [newWord, setNewWord] = useState("")
  const [isAdding, setIsAdding] = useState(false)

  const handleAddWord = async () => {
    if (!newWord.trim()) {
      toast.error("敏感词不能为空")
      return
    }

    if (words.includes(newWord.trim())) {
      toast.error("该敏感词已存在")
      return
    }

    try {
      setIsAdding(true)
      const result = await addSensitiveWord(newWord.trim())

      if (!result.success) {
        toast.error(result.error || "添加失败")
        return
      }

      setWords([...words, newWord.trim()])
      setNewWord("")
      toast.success("添加成功")
      onUpdate?.()
    } catch (error: any) {
      toast.error(error.message || "添加失败")
    } finally {
      setIsAdding(false)
    }
  }

  const handleRemoveWord = async (word: string) => {
    try {
      const result = await removeSensitiveWord(word)

      if (!result.success) {
        toast.error(result.error || "删除失败")
        return
      }

      setWords(words.filter((w) => w !== word))
      toast.success("删除成功")
      onUpdate?.()
    } catch (error: any) {
      toast.error(error.message || "删除失败")
    }
  }

  return (
    <div className="space-y-4">
      {/* 添加敏感词 */}
      <div className="flex gap-2">
        <Input
          placeholder="输入敏感词，例如：微信、QQ、网址等"
          value={newWord}
          onChange={(e) => setNewWord(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              handleAddWord()
            }
          }}
          disabled={isAdding}
        />
        <Button onClick={handleAddWord} disabled={isAdding || !newWord.trim()}>
          <Plus className="h-4 w-4 mr-1" />
          添加
        </Button>
      </div>

      {/* 提示信息 */}
      <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-900">
        <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
        <div className="flex-1">
          <p className="font-medium">提示</p>
          <p className="text-blue-700 mt-1">
            敏感词会在用户提交商家入驻申请时进行检测。如果详情描述中包含敏感词，将阻止提交并提示用户修改。
          </p>
        </div>
      </div>

      {/* 敏感词列表 */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">
            当前敏感词列表 <span className="text-muted-foreground">({words.length}个)</span>
          </p>
        </div>

        {words.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>暂无敏感词</p>
            <p className="text-xs mt-1">添加敏感词以过滤不当内容</p>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {words.map((word) => (
              <Badge
                key={word}
                variant="secondary"
                className="pl-3 pr-1 py-1 text-sm flex items-center gap-2"
              >
                {word}
                <button
                  onClick={() => handleRemoveWord(word)}
                  className="hover:bg-destructive/20 rounded-full p-0.5 transition-colors"
                  title="删除"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* 统计信息 */}
      {words.length > 0 && (
        <div className="pt-2 border-t text-xs text-muted-foreground">
          <p>
            已配置 {words.length} 个敏感词，将在用户提交内容时自动检测
          </p>
        </div>
      )}
    </div>
  )
}
