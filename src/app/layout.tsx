import { ReactNode } from "react"

interface LayoutProps {
  children: ReactNode
}
export default async function Layout({ children }: LayoutProps) {
  return children
}
