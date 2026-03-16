"use client"

import { Badge } from "@/components/ui/badge"
import { sourceLabel, sourceColor } from "@/lib/utils"
import { cn } from "@/lib/utils"

interface SourceBadgeProps {
  source: string
  className?: string
}

export function SourceBadge({ source, className }: SourceBadgeProps) {
  return (
    <Badge
      className={cn(
        "text-xs font-semibold border-0",
        sourceColor(source),
        className
      )}
    >
      {sourceLabel(source)}
    </Badge>
  )
}
