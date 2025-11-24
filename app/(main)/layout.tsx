import { Navigation } from "@/components/navigation"

export default function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <Navigation />
      <main>{children}</main>
    </>
  )
}
