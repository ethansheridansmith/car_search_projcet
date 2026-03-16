import { Badge } from "@/components/ui/badge"
import { formatPrice } from "@/lib/utils"

interface PriceBadgeProps {
  priceDrop?: number
}

export function PriceBadge({ priceDrop }: PriceBadgeProps) {
  if (!priceDrop || priceDrop <= 0) return null

  return (
    <Badge className="bg-green-100 text-green-700 border-green-200 text-xs font-semibold">
      ↓ {formatPrice(priceDrop)} drop
    </Badge>
  )
}
