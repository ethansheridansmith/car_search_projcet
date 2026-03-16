"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { Heart, ExternalLink, ArrowUpDown, ArrowUp, ArrowDown, Car } from "lucide-react"
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

interface ListingTableProps {
  listings: Listing[]
  savedCarIds?: Record<string, string>
  onSave?: (listing: Listing) => void
  onUnsave?: (savedCarId: string) => void
}

type SortKey = "price" | "year" | "mileage" | "daysOnMarket" | "distance"
type SortDir = "asc" | "desc"

export function ListingTable({ listings, savedCarIds = {}, onSave, onUnsave }: ListingTableProps) {
  const [sortKey, setSortKey] = React.useState<SortKey>("price")
  const [sortDir, setSortDir] = React.useState<SortDir>("asc")

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortKey(key)
      setSortDir("asc")
    }
  }

  const sorted = React.useMemo(() => {
    return [...listings].sort((a, b) => {
      let av: number | undefined
      let bv: number | undefined
      switch (sortKey) {
        case "price":
          av = a.price; bv = b.price; break
        case "year":
          av = a.year; bv = b.year; break
        case "mileage":
          av = a.mileage ?? Infinity; bv = b.mileage ?? Infinity; break
        case "daysOnMarket":
          av = a.daysOnMarket ?? daysOnMarket(a.firstSeen)
          bv = b.daysOnMarket ?? daysOnMarket(b.firstSeen)
          break
        case "distance":
          av = a.distance ?? Infinity; bv = b.distance ?? Infinity; break
      }
      if (av === undefined || bv === undefined) return 0
      return sortDir === "asc" ? av - bv : bv - av
    })
  }, [listings, sortKey, sortDir])

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-50" />
    return sortDir === "asc"
      ? <ArrowUp className="h-3 w-3 ml-1" />
      : <ArrowDown className="h-3 w-3 ml-1" />
  }

  const SortHeader = ({ col, label }: { col: SortKey; label: string }) => (
    <button
      onClick={() => handleSort(col)}
      className="flex items-center hover:text-foreground transition-colors"
    >
      {label}
      <SortIcon col={col} />
    </button>
  )

  return (
    <div className="w-full overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50 text-muted-foreground text-xs">
            <th className="py-3 px-3 text-left font-medium">Photo</th>
            <th className="py-3 px-3 text-left font-medium">Vehicle</th>
            <th className="py-3 px-3 text-left font-medium">
              <SortHeader col="year" label="Year" />
            </th>
            <th className="py-3 px-3 text-left font-medium">
              <SortHeader col="price" label="Price" />
            </th>
            <th className="py-3 px-3 text-left font-medium">
              <SortHeader col="mileage" label="Mileage" />
            </th>
            <th className="py-3 px-3 text-left font-medium">Fuel</th>
            <th className="py-3 px-3 text-left font-medium">Trans</th>
            <th className="py-3 px-3 text-left font-medium">
              <SortHeader col="distance" label="Distance" />
            </th>
            <th className="py-3 px-3 text-left font-medium">Source</th>
            <th className="py-3 px-3 text-left font-medium">
              <SortHeader col="daysOnMarket" label="DOM" />
            </th>
            <th className="py-3 px-3 text-left font-medium">Seller</th>
            <th className="py-3 px-3 text-left font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((listing, idx) => {
            const images = getImageUrls(listing.imageUrls)
            const firstImage = images[0] ?? null
            const isSaved = !!savedCarIds[listing.id]
            const savedCarId = savedCarIds[listing.id]
            const dom = listing.daysOnMarket ?? daysOnMarket(listing.firstSeen)

            return (
              <tr
                key={listing.id}
                className={cn(
                  "border-b transition-colors hover:bg-muted/50",
                  idx % 2 === 0 ? "bg-background" : "bg-muted/20"
                )}
              >
                {/* Photo */}
                <td className="py-2 px-3">
                  <Link href={`/listing/${listing.id}`}>
                    <div className="relative w-[60px] h-[45px] rounded overflow-hidden bg-muted flex-shrink-0">
                      {firstImage ? (
                        <Image
                          src={firstImage}
                          alt={listing.title}
                          fill
                          className="object-cover"
                          sizes="60px"
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full">
                          <Car className="h-4 w-4 text-muted-foreground/40" />
                        </div>
                      )}
                    </div>
                  </Link>
                </td>

                {/* Vehicle */}
                <td className="py-2 px-3 max-w-[180px]">
                  <Link
                    href={`/listing/${listing.id}`}
                    className="font-medium hover:text-primary transition-colors line-clamp-2 text-xs leading-tight"
                  >
                    {listing.make} {listing.model}
                    {listing.trim && <span className="text-muted-foreground"> {listing.trim}</span>}
                  </Link>
                </td>

                {/* Year */}
                <td className="py-2 px-3 text-xs">{listing.year}</td>

                {/* Price */}
                <td className="py-2 px-3">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-semibold text-xs">{formatPrice(listing.price)}</span>
                    {listing.priceDrop && listing.priceDrop > 0 && (
                      <PriceBadge priceDrop={listing.priceDrop} />
                    )}
                  </div>
                </td>

                {/* Mileage */}
                <td className="py-2 px-3 text-xs text-muted-foreground">
                  {listing.mileage != null ? formatMileage(listing.mileage) : "—"}
                </td>

                {/* Fuel */}
                <td className="py-2 px-3 text-xs text-muted-foreground">
                  {listing.fuelType ?? "—"}
                </td>

                {/* Transmission */}
                <td className="py-2 px-3 text-xs text-muted-foreground">
                  {listing.transmission ? listing.transmission.slice(0, 4) : "—"}
                </td>

                {/* Distance */}
                <td className="py-2 px-3 text-xs text-muted-foreground">
                  {listing.distance != null ? formatDistance(listing.distance) : "—"}
                </td>

                {/* Source */}
                <td className="py-2 px-3">
                  <SourceBadge source={listing.source} />
                </td>

                {/* Days on market */}
                <td className="py-2 px-3 text-xs text-muted-foreground">{dom}d</td>

                {/* Seller type */}
                <td className="py-2 px-3">
                  {listing.sellerType && (
                    <Badge variant="outline" className="text-xs py-0">
                      {listing.sellerType === "dealer" ? "Dealer" : "Private"}
                    </Badge>
                  )}
                </td>

                {/* Actions */}
                <td className="py-2 px-3">
                  <div className="flex items-center gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className={cn(
                        "h-7 w-7",
                        isSaved ? "text-red-500 hover:text-red-600" : "text-muted-foreground hover:text-red-400"
                      )}
                      onClick={() => {
                        if (isSaved && savedCarId) onUnsave?.(savedCarId)
                        else onSave?.(listing)
                      }}
                      aria-label={isSaved ? "Remove from saved" : "Save"}
                    >
                      <Heart className={cn("h-3.5 w-3.5", isSaved && "fill-current")} />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-muted-foreground hover:text-foreground"
                      onClick={() => window.open(listing.listingUrl, "_blank", "noopener,noreferrer")}
                      aria-label="View on source"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {sorted.length === 0 && (
        <div className="py-12 text-center text-muted-foreground text-sm">No listings found</div>
      )}
    </div>
  )
}
