"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { X, ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getActiveBanners } from "@/lib/actions/banners"
import type { Banner } from "@/lib/types/database"

const BANNER_CLOSED_KEY = "banner_closed_date"

export function HomeBanners() {
  const [banners, setBanners] = useState<{
    left: Banner[]
    middle: Banner[]
    right: Banner[]
  } | null>(null)
  const [isClosed, setIsClosed] = useState(false)
  const [leftCurrentIndex, setLeftCurrentIndex] = useState(0)
  const [rightCurrentIndex, setRightCurrentIndex] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // 检查是否今天已经关闭过
    const closedDate = localStorage.getItem(BANNER_CLOSED_KEY)
    const today = new Date().toDateString()

    if (closedDate === today) {
      setIsClosed(true)
      setLoading(false)
      return
    }

    loadBanners()
  }, [])

  // 左侧轮播自动切换
  useEffect(() => {
    if (!banners || !banners.left || banners.left.length <= 1) return

    const timer = setInterval(() => {
      setLeftCurrentIndex((prev) => (prev + 1) % banners.left.length)
    }, 5000) // 5秒切换一次

    return () => clearInterval(timer)
  }, [banners])

  // 右侧轮播自动切换
  useEffect(() => {
    if (!banners || !banners.right || banners.right.length <= 1) return

    const timer = setInterval(() => {
      setRightCurrentIndex((prev) => (prev + 1) % banners.right.length)
    }, 5000) // 5秒切换一次

    return () => clearInterval(timer)
  }, [banners])

  async function loadBanners() {
    try {
      const result = await getActiveBanners()

      if (result.success && result.data) {
        setBanners(result.data)
      }
    } catch (error) {
      console.error("Error loading banners:", error)
    } finally {
      setLoading(false)
    }
  }

  function handleClose() {
    // 记录今天的日期
    const today = new Date().toDateString()
    localStorage.setItem(BANNER_CLOSED_KEY, today)
    setIsClosed(true)
  }

  function handlePrevSlide() {
    if (!banners || !banners.left) return
    setLeftCurrentIndex(
      (prev) => (prev - 1 + banners.left.length) % banners.left.length
    )
  }

  function handleNextSlide() {
    if (!banners || !banners.left) return
    setLeftCurrentIndex((prev) => (prev + 1) % banners.left.length)
  }

  function handleRightPrevSlide() {
    if (!banners || !banners.right) return
    setRightCurrentIndex(
      (prev) => (prev - 1 + banners.right.length) % banners.right.length
    )
  }

  function handleRightNextSlide() {
    if (!banners || !banners.right) return
    setRightCurrentIndex((prev) => (prev + 1) % banners.right.length)
  }

  // 如果已关闭或加载中，不显示
  if (loading || isClosed) return null

  // 如果没有任何激活的banner，不显示
  if (
    !banners ||
    (banners.left.length === 0 &&
      banners.middle.length === 0 &&
      banners.right.length === 0)
  ) {
    return null
  }

  return (
    <div className="relative w-full mb-4 hidden lg:block">
      {/* 关闭按钮 */}
      <Button
        variant="ghost"
        size="icon"
        className="absolute -top-2 -right-2 z-20 h-8 w-8 rounded-full bg-white hover:bg-gray-100 shadow-md border"
        onClick={handleClose}
      >
        <X className="h-4 w-4" />
      </Button>

      {/* Banner内容 - Flex响应式布局 */}
      <div className="flex gap-4">
        {/* 左侧轮播 - 52.5% */}
        {banners.left.length > 0 && (
          <div className="relative flex-[5.25] h-[180px] rounded-lg overflow-hidden shadow-md">
            {banners.left.map((banner, index) => (
              <BannerItem
                key={banner.id}
                banner={banner}
                isActive={index === leftCurrentIndex}
                className="absolute inset-0"
              />
            ))}

            {/* 轮播控制按钮 */}
            {banners.left.length > 1 && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute left-2 top-1/2 -translate-y-1/2 z-10 h-8 w-8 rounded-full bg-white/80 hover:bg-white shadow-sm"
                  onClick={handlePrevSlide}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-2 top-1/2 -translate-y-1/2 z-10 h-8 w-8 rounded-full bg-white/80 hover:bg-white shadow-sm"
                  onClick={handleNextSlide}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>

                {/* 指示器 */}
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2 z-10">
                  {banners.left.map((_, index) => (
                    <button
                      key={index}
                      className={`h-2 rounded-full transition-all cursor-pointer ${
                        index === leftCurrentIndex
                          ? "w-6 bg-white"
                          : "w-2 bg-white/50"
                      }`}
                      onClick={() => setLeftCurrentIndex(index)}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* 中间栏 - 17.5% (上下两格) */}
        {banners.middle.length > 0 && (
          <div className="flex-[1.75] h-[180px] flex flex-col gap-3">
            {/* 显示前2个middle banner,平均分配高度 */}
            {banners.middle.slice(0, 2).map((banner, index) => (
              <div
                key={banner.id}
                className="h-[84px] rounded-lg overflow-hidden shadow-md"
              >
                <BannerItem banner={banner} />
              </div>
            ))}
            {/* 如果只有1个middle banner,添加占位符 */}
            {banners.middle.length === 1 && (
              <div className="h-[84px] rounded-lg bg-gray-100" />
            )}
          </div>
        )}

        {/* 右侧轮播 - 27% */}
        {banners.right.length > 0 && (
          <div className="relative flex-[2.7] h-[180px] rounded-lg overflow-hidden shadow-md">
            {banners.right.map((banner, index) => (
              <BannerItem
                key={banner.id}
                banner={banner}
                isActive={index === rightCurrentIndex}
                className="absolute inset-0"
              />
            ))}

            {/* 轮播控制按钮 */}
            {banners.right.length > 1 && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute left-2 top-1/2 -translate-y-1/2 z-10 h-8 w-8 rounded-full bg-white/80 hover:bg-white shadow-sm"
                  onClick={handleRightPrevSlide}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-2 top-1/2 -translate-y-1/2 z-10 h-8 w-8 rounded-full bg-white/80 hover:bg-white shadow-sm"
                  onClick={handleRightNextSlide}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>

                {/* 指示器 */}
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2 z-10">
                  {banners.right.map((_, index) => (
                    <button
                      key={index}
                      className={`h-2 rounded-full transition-all cursor-pointer ${
                        index === rightCurrentIndex
                          ? "w-6 bg-white"
                          : "w-2 bg-white/50"
                      }`}
                      onClick={() => setRightCurrentIndex(index)}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

interface BannerItemProps {
  banner: Banner
  isActive?: boolean
  className?: string
}

function BannerItem({ banner, isActive = true, className = "" }: BannerItemProps) {
  const content = (
    <div
      className={`relative w-full h-full transition-opacity duration-500 ${
        isActive ? "opacity-100 z-10" : "opacity-0 pointer-events-none z-0"
      }`}
    >
      <Image
        src={banner.image_url}
        alt={banner.title || "Banner"}
        fill
        className="object-cover"
        priority={isActive}
      />

      {/* 悬浮信息 */}
      {(banner.title || banner.description) && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-4">
          {banner.title && (
            <h3 className="text-white font-semibold text-lg mb-1">
              {banner.title}
            </h3>
          )}
          {banner.description && (
            <p className="text-white/90 text-sm line-clamp-2">
              {banner.description}
            </p>
          )}
        </div>
      )}
    </div>
  )

  // 如果有链接，包裹在Link组件中
  if (banner.link_url) {
    return (
      <Link
        href={banner.link_url}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
      >
        {content}
      </Link>
    )
  }

  return <div className={className}>{content}</div>
}
