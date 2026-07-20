import type { LucideIcon } from "lucide-react"
import Link from "next/link"

import { cn } from "@/lib/utils"

interface BottomNavItem {
  href: string
  label: string
  icon: LucideIcon
  badge?: number
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
        "fixed inset-x-0 bottom-0 z-20 flex items-stretch justify-around border-t border-border bg-card pb-[env(safe-area-inset-bottom)]",
        className
      )}
      {...props}
    >
      {items.map(({ href, label, icon: Icon, badge }) => {
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
            <span className="relative">
              <Icon className="size-5" aria-hidden="true" />
              {Boolean(badge) && badge! > 0 && (
                <span
                  className="absolute -top-1.5 -right-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-action-deep px-1 text-[0.625rem] font-bold leading-none text-action-foreground"
                  aria-hidden="true"
                >
                  {badge! > 9 ? "9+" : badge}
                </span>
              )}
            </span>
            {label}
            {Boolean(badge) && badge! > 0 && <span className="sr-only">, {badge} pendente{badge! > 1 ? "s" : ""}</span>}
          </Link>
        )
      })}
    </nav>
  )
}

export { BottomNav }
export type { BottomNavItem }
