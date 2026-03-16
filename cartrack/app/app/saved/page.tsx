"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { Heart, ExternalLink, Car, TrendingDown, TrendingUp, Minus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { SourceBadge } from "@/components/source-badge"
import { useToast } from "@/components/ui/use-toast"
import { formatPrice, formatMileage, getImageUrls, daysOnMarket } from "@/lib/utils"
import type { SavedCar, Listing } from "@/lib/types"

interface SavedCarWithListing extends SavedCar {
  listing?: Listing
}

function PriceChange({ current, atSave }: { current: number; atSave: number }) {
  const diff = current - atSave
  if (diff === 0) return (
    <span className="flex items-center gap-1 text-xs text-muted-foreground">
      <Minus className="h-3 w-3" /> No change
    </span>
  )
  return diff < 0 ? (
    <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
      <TrendingDown className="h-3 w-3" />
      {formatPrice(Math.abs(diff))} drop
    </span>
  ) : (
    <span className="flex items-center gap-1 text-xs text-red-500 font-medium">
      <TrendingUp className="h-3 w-3" />
      {formatPrice(diff)} increase
    </span>
  )
}

export default function SavedPage() {
  const { toast } = useToast()
  const [savedCars, setSavedCars] = React.useState<SavedCarWithListing[]>([])
  const [loading, setLoading] = React.useState(true)
  const [notes, setNotes] = React.useState<Record<string, string>>({})
  const [savingNote, setSavingNote] = React.useState<string | null>(null)

  React.useEffect(() => {
    fetchSaved()
  }, [])

  async function fetchSaved() {
    setLoading(true)
    try {
      const res = await fetch("/api/saved")
      if (!res.ok) throw new Error()
      const data = await res.json()
      const items: SavedCarWithListing[] = data.savedCars ?? data ?? []
      setSavedCars(items)
      const notesMap: Record<string, string> = {}
      items.forEach((sc) => { notesMap[sc.id] = sc.notes ?? "" })
      setNotes(notesMap)
    } catch {
      toast({ title: "Error", description: "Failed to load saved cars", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  async function handleRemove(savedCarId: string) {
    try {
      const res = await fetch(`/api/saved/${savedCarId}`, { method: "DELETE" })
      if (!res.ok) throw new Error()
      setSavedCars((prev) => prev.filter((sc) => sc.id !== savedCarId))
      toast({ title: "Removed", description: "Removed from saved cars" })
    } catch {
      toast({ title: "Error", description: "Failed to remove", variant: "destructive" })
    }
  }

  async function handleNoteBlur(savedCarId: string) {
    setSavingNote(savedCarId)
    try {
      await fetch(`/api/saved/${savedCarId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: notes[savedCarId] ?? "" }),
      })
    } catch {
      toast({ title: "Error", description: "Failed to save note", variant: "destructive" })
    } finally {
      setSavingNote(null)
    }
  }

  const avgPrice =
    savedCars.length > 0
      ? savedCars.reduce((sum, sc) => sum + (sc.listing?.price ?? sc.priceAtSave), 0) / savedCars.length
      : 0

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-6 max-w-5xl">
        <Skeleton className="h-8 w-48 mb-6" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-64 w-full rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Saved Cars</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {savedCars.length} saved
            {savedCars.length > 0 && ` · Avg ${formatPrice(Math.round(avgPrice))}`}
          </p>
        </div>
      </div>

      {savedCars.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <Heart className="h-12 w-12 text-muted-foreground/30 mb-4" />
          <h3 className="text-lg font-semibold mb-1">No saved cars yet</h3>
          <p className="text-muted-foreground text-sm mb-6">
            Save cars while browsing to track them here.
          </p>
          <Button asChild>
            <Link href="/search">Browse listings</Link>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {savedCars.map((sc) => {
            const listing = sc.listing
            if (!listing) return null
            const images = getImageUrls(listing.imageUrls)
            const firstImage = images[0] ?? null
            const dom = listing.daysOnMarket ?? daysOnMarket(listing.firstSeen)

            return (
              <Card key={sc.id} className="overflow-hidden">
                {/* Image */}
                <Link href={`/listing/${listing.id}`}>
                  <div className="relative h-40 bg-muted overflow-hidden">
                    {firstImage ? (
                      <Image
                        src={firstImage}
                        alt={listing.title}
                        fill
                        className="object-cover hover:scale-105 transition-transform duration-200"
                        sizes="(max-width: 768px) 100vw, 50vw"
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <Car className="h-12 w-12 text-muted-foreground/30" />
                      </div>
                    )}
                    <div className="absolute top-2 right-2">
                      <SourceBadge source={listing.source} />
                    </div>
                  </div>
                </Link>

                <CardContent className="p-4 space-y-3">
                  {/* Title + price */}
                  <div>
                    <Link
                      href={`/listing/${listing.id}`}
                      className="font-semibold text-sm hover:text-primary transition-colors line-clamp-1"
                    >
                      {listing.title || `${listing.year} ${listing.make} ${listing.model}`}
                    </Link>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-lg font-bold text-primary">{formatPrice(listing.price)}</span>
                      <PriceChange current={listing.price} atSave={sc.priceAtSave} />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Saved at {formatPrice(sc.priceAtSave)} · {dom}d on market
                    </p>
                  </div>

                  {/* Quick specs */}
                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    {listing.year && <span>{listing.year}</span>}
                    {listing.mileage != null && <span>· {formatMileage(listing.mileage)}</span>}
                    {listing.fuelType && <span>· {listing.fuelType}</span>}
                    {listing.transmission && <span>· {listing.transmission}</span>}
                  </div>

                  {/* Notes */}
                  <div>
                    <textarea
                      className="w-full text-xs rounded-md border bg-muted/30 px-2 py-1.5 resize-none focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/60"
                      rows={2}
                      placeholder="Add a note..."
                      value={notes[sc.id] ?? ""}
                      onChange={(e) => setNotes((prev) => ({ ...prev, [sc.id]: e.target.value }))}
                      onBlur={() => handleNoteBlur(sc.id)}
                    />
                    {savingNote === sc.id && (
                      <p className="text-xs text-muted-foreground">Saving...</p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 text-xs"
                      onClick={() => window.open(listing.listingUrl, "_blank", "noopener,noreferrer")}
                    >
                      <ExternalLink className="h-3 w-3 mr-1" />
                      View listing
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-500 hover:text-red-600 hover:bg-red-50 text-xs"
                      onClick={() => handleRemove(sc.id)}
                    >
                      <Heart className="h-3.5 w-3.5 mr-1 fill-current" />
                      Remove
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
