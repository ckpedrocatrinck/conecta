import type { LucideIcon } from "lucide-react"
import Link from "next/link"

import { cn } from "@/lib/utils"

interface BottomNavItem {
  href: string
  label: string
  icon: LucideIcon
}

interface BottomNavProps extends React.ComponentProps<"nav"> {
  items: BottomNavItem[]
  activeHref: string
}

function BottomNav({ items, activeHref, className, ...props }: BottomNavProps) {
  return (
    <nav
      data-slot="bottom-nav"
      className={cn(
        "flex items-stretch justify-around border-t border-border bg-card",
        className
      )}
      {...props}
    >
      {items.map(({ href, label, icon: Icon }) => {
        const isActive = href === activeHref
        return (
          <Link
            key={href}
            href={href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "flex min-h-12 flex-1 flex-col items-center justify-center gap-0.5 px-2 py-1.5 text-[0.6875rem] font-semibold",
              isActive ? "text-primary" : "text-muted-foreground"
            )}
          >
            <Icon className="size-5" aria-hidden="true" />
            {label}
          </Link>
        )
      })}
    </nav>
  )
}

export { BottomNav }
export type { BottomNavItem }
