"use client"

import * as React from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import {
  Calendar,
  Gauge,
  Zap,
  Settings2,
  MapPin,
  Heart,
  ExternalLink,
  Car,
  Clock,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { SourceBadge } from "@/components/source-badge"
import { PriceBadge } from "@/components/price-badge"
import {
  cn,
  formatPrice,
  formatMileage,
  formatDistance,
  getImageUrls,
  daysOnMarket,
} from "@/lib/utils"
import type { Listing } from "@/lib/types"

interface ListingCardProps {
  listing: Listing
  onSave?: (listing: Listing) => void
  onUnsave?: (savedCarId: string) => void
  savedCarId?: string
}

export function ListingCard({ listing, onSave, onUnsave, savedCarId }: ListingCardProps) {
  const router = useRouter()
  const isSaved = !!savedCarId
  const images = getImageUrls(listing.imageUrls)
  const firstImage = images[0] ?? null
  const dom = listing.daysOnMarket ?? daysOnMarket(listing.firstSeen)
  const [imgError, setImgError] = React.useState(false)

  const handleCardClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement
    if (target.closest("button") || target.closest("a")) return
    router.push(`/listing/${listing.id}`)
  }

  const handleSaveToggle = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (isSaved && savedCarId) {
      onUnsave?.(savedCarId)
    } else {
      onSave?.(listing)
    }
  }

  const handleViewListing = (e: React.MouseEvent) => {
    e.stopPropagation()
    window.open(listing.listingUrl, "_blank", "noopener,noreferrer")
  }

  return (
    <Card
      className="group overflow-hidden cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-[1.01]"
      onClick={handleCardClick}
    >
      {/* Image */}
      <div className="relative h-48 bg-muted overflow-hidden">
        {firstImage && !imgError ? (
          <Image
            src={firstImage}
            alt={listing.title}
            fill
            className="object-cover transition-transform duration-200 group-hover:scale-105"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full bg-gradient-to-br from-slate-100 to-slate-200 gap-2">
            <Car className="h-12 w-12 text-slate-400" />
            <span className="text-xs text-slate-400 font-medium">{listing.make}</span>
          </div>
        )}

        {/* Source badge overlay */}
        <div className="absolute top-2 right-2">
          <SourceBadge source={listing.source} />
        </div>

        {/* Price drop badge overlay */}
        {listing.priceDrop && listing.priceDrop > 0 && (
          <div className="absolute top-2 left-2">
            <PriceBadge priceDrop={listing.priceDrop} />
          </div>
        )}
      </div>

      <CardContent className="p-4">
        {/* Title */}
        <h3 className="font-semibold text-sm leading-tight line-clamp-2 mb-1">
          {listing.title || `${listing.year} ${listing.make} ${listing.model}${listing.trim ? ` ${listing.trim}` : ""}`}
        </h3>

        {/* Price */}
        <div className="flex items-baseline gap-2 mb-3">
          <span className="text-xl font-bold text-primary">{formatPrice(listing.price)}</span>
        </div>

        {/* Specs grid */}
        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 mb-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Calendar className="h-3 w-3 flex-shrink-0" />
            <span>{listing.year}</span>
          </div>
          {listing.mileage != null && (
            <div className="flex items-center gap-1">
              <Gauge className="h-3 w-3 flex-shrink-0" />
              <span>{formatMileage(listing.mileage)}</span>
            </div>
          )}
          {listing.fuelType && (
            <div className="flex items-center gap-1">
              <Zap className="h-3 w-3 flex-shrink-0" />
              <span>{listing.fuelType}</span>
            </div>
          )}
          {listing.transmission && (
            <div className="flex items-center gap-1">
              <Settings2 className="h-3 w-3 flex-shrink-0" />
              <span>{listing.transmission}</span>
            </div>
          )}
        </div>

        {/* Location */}
        {(listing.location || listing.distance != null) && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
            <MapPin className="h-3 w-3 flex-shrink-0" />
            <span className="truncate">
              {listing.location}
              {listing.distance != null && ` • ${formatDistance(listing.distance)}`}
            </span>
          </div>
        )}

        {/* Days on market + seller type */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>{dom} {dom === 1 ? "day" : "days"}</span>
          </div>
          {listing.sellerType && (
            <Badge variant="outline" className="text-xs">
              {listing.sellerType === "dealer" ? "Dealer" : "Private"}
            </Badge>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className="flex-1 text-xs"
            onClick={handleViewListing}
          >
            <ExternalLink className="h-3 w-3 mr-1" />
            View listing
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className={cn(
              "h-8 w-8",
              isSaved ? "text-red-500 hover:text-red-600" : "text-muted-foreground hover:text-red-400"
            )}
            onClick={handleSaveToggle}
            aria-label={isSaved ? "Remove from saved" : "Save listing"}
          >
            <Heart className={cn("h-4 w-4", isSaved && "fill-current")} />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
