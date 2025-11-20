import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export function MerchantListSkeleton() {
  return (
    <div className="space-y-4">
      {/* PC端骨架屏 */}
      <Card className="hidden lg:block p-6">
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-4 p-4 border-b last:border-b-0">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-[200px]" />
                <Skeleton className="h-3 w-[300px]" />
              </div>
              <Skeleton className="h-8 w-[100px]" />
            </div>
          ))}
        </div>
      </Card>

      {/* 移动端骨架屏 */}
      <div className="lg:hidden space-y-3">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="p-3">
            <div className="flex items-start gap-2.5 mb-2">
              <Skeleton className="h-12 w-12 rounded-full flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-[150px]" />
                <div className="flex gap-1.5">
                  <Skeleton className="h-4 w-12" />
                  <Skeleton className="h-4 w-16" />
                </div>
              </div>
            </div>
            <Skeleton className="h-3 w-full mb-1" />
            <Skeleton className="h-3 w-3/4 mb-2" />
            <div className="flex justify-between items-center pt-2 border-t">
              <Skeleton className="h-3 w-[100px]" />
              <Skeleton className="h-7 w-[80px]" />
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
