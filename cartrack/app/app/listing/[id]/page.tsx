"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import {
  ArrowLeft,
  Calendar,
  Gauge,
  Zap,
  Settings2,
  MapPin,
  Heart,
  ExternalLink,
  Car,
  Clock,
  Tag,
  Palette,
  Info,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import { SourceBadge } from "@/components/source-badge"
import { PriceBadge } from "@/components/price-badge"
import { useToast } from "@/components/ui/use-toast"
import {
  formatPrice,
  formatMileage,
  formatDistance,
  getImageUrls,
  daysOnMarket,
  sourceLabel,
} from "@/lib/utils"
import type { Listing } from "@/lib/types"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"

function formatDate(d: Date | string) {
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
}

export default function ListingDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const id = params?.id as string

  const [listing, setListing] = React.useState<Listing | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [notFound, setNotFound] = React.useState(false)
  const [savedCarId, setSavedCarId] = React.useState<string | null>(null)
  const [imageIndex, setImageIndex] = React.useState(0)
  const [lightboxOpen, setLightboxOpen] = React.useState(false)

  React.useEffect(() => {
    if (!id) return
    setLoading(true)
    fetch(`/api/listings/${id}`)
      .then((r) => {
        if (r.status === 404) { setNotFound(true); return null }
        if (!r.ok) throw new Error()
        return r.json()
      })
      .then((data) => {
        if (data) setListing(data.listing ?? data)
      })
      .catch(() => toast({ title: "Error", description: "Failed to load listing", variant: "destructive" }))
      .finally(() => setLoading(false))
  }, [id])

  // Check if saved
  React.useEffect(() => {
    if (!listing) return
    fetch("/api/saved")
      .then((r) => r.json())
      .then((data) => {
        const saved = (data.savedCars ?? data ?? []).find(
          (sc: { id: string; listingId: string }) => sc.listingId === listing.id
        )
        if (saved) setSavedCarId(saved.id)
      })
      .catch(() => {})
  }, [listing])

  async function handleSaveToggle() {
    if (!listing) return
    if (savedCarId) {
      try {
        await fetch(`/api/saved/${savedCarId}`, { method: "DELETE" })
        setSavedCarId(null)
        toast({ title: "Removed", description: "Removed from saved cars" })
      } catch {
        toast({ title: "Error", description: "Failed to remove", variant: "destructive" })
      }
    } else {
      try {
        const res = await fetch("/api/saved", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ listingId: listing.id, priceAtSave: listing.price }),
        })
        if (!res.ok) throw new Error()
        const data = await res.json()
        setSavedCarId(data.id ?? data.savedCar?.id)
        toast({ title: "Saved", description: `${listing.make} ${listing.model} saved` })
      } catch {
        toast({ title: "Error", description: "Failed to save", variant: "destructive" })
      }
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-6 max-w-5xl">
        <Skeleton className="h-8 w-32 mb-4" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-80 w-full rounded-xl" />
          <div className="space-y-4">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-10 w-1/2" />
            <div className="grid grid-cols-2 gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (notFound || !listing) {
    return (
      <div className="container mx-auto px-4 py-24 text-center max-w-lg">
        <div className="text-6xl mb-4">🔍</div>
        <h1 className="text-2xl font-bold mb-2">Listing not found</h1>
        <p className="text-muted-foreground mb-6">
          This listing may have been removed or the ID is invalid.
        </p>
        <Button onClick={() => router.push("/listings")} variant="outline">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to listings
        </Button>
      </div>
    )
  }

  const images = getImageUrls(listing.imageUrls)
  const dom = listing.daysOnMarket ?? daysOnMarket(listing.firstSeen)
  const priceHistory = listing.priceHistory ?? []

  const priceChartData = priceHistory.map((ph) => ({
    date: new Date(ph.recordedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
    price: ph.price,
  }))

  const specs = [
    { icon: Calendar, label: "Year", value: String(listing.year) },
    { icon: Gauge, label: "Mileage", value: listing.mileage != null ? formatMileage(listing.mileage) : null },
    { icon: Zap, label: "Fuel", value: listing.fuelType },
    { icon: Settings2, label: "Transmission", value: listing.transmission },
    { icon: Palette, label: "Colour", value: listing.colour },
    { icon: Info, label: "Engine", value: listing.engineSize },
    { icon: Tag, label: "Seller", value: listing.sellerType ? (listing.sellerType === "dealer" ? "Dealer" : "Private") : null },
    { icon: MapPin, label: "Location", value: listing.location },
    { icon: Clock, label: "Days on market", value: `${dom} ${dom === 1 ? "day" : "days"}` },
    { icon: Calendar, label: "First seen", value: formatDate(listing.firstSeen) },
  ].filter((s) => s.value)

  return (
    <div className="container mx-auto px-4 py-6 max-w-5xl">
      {/* Back button */}
      <Button variant="ghost" size="sm" onClick={() => router.back()} className="mb-4 gap-1">
        <ArrowLeft className="h-4 w-4" />
        Back
      </Button>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Image gallery */}
        <div>
          <div
            className="relative h-72 sm:h-96 rounded-xl overflow-hidden bg-muted cursor-pointer"
            onClick={() => setLightboxOpen(true)}
          >
            {images.length > 0 ? (
              <Image
                src={images[imageIndex]}
                alt={listing.title}
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 50vw"
                priority
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <Car className="h-20 w-20 text-muted-foreground/30" />
              </div>
            )}
            {images.length > 1 && (
              <>
                <button
                  className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 rounded-full p-1.5 text-white hover:bg-black/70 transition-colors"
                  onClick={(e) => { e.stopPropagation(); setImageIndex((i) => (i - 1 + images.length) % images.length) }}
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button
                  className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 rounded-full p-1.5 text-white hover:bg-black/70 transition-colors"
                  onClick={(e) => { e.stopPropagation(); setImageIndex((i) => (i + 1) % images.length) }}
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-white text-xs bg-black/50 rounded-full px-2 py-0.5">
                  {imageIndex + 1} / {images.length}
                </div>
              </>
            )}
          </div>

          {/* Thumbnail strip */}
          {images.length > 1 && (
            <div className="flex gap-2 mt-2 overflow-x-auto pb-1">
              {images.map((img, i) => (
                <button
                  key={i}
                  onClick={() => setImageIndex(i)}
                  className={`relative flex-shrink-0 w-16 h-12 rounded-md overflow-hidden border-2 transition-colors ${
                    i === imageIndex ? "border-primary" : "border-transparent"
                  }`}
                >
                  <Image src={img} alt="" fill className="object-cover" sizes="64px" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Details */}
        <div className="space-y-4">
          {/* Title + price */}
          <div>
            <div className="flex items-start justify-between gap-2 mb-1">
              <SourceBadge source={listing.source} />
              {!listing.isActive && (
                <Badge variant="destructive" className="text-xs">Inactive</Badge>
              )}
            </div>
            <h1 className="text-2xl font-bold leading-tight mt-2">
              {listing.title || `${listing.year} ${listing.make} ${listing.model}${listing.trim ? ` ${listing.trim}` : ""}`}
            </h1>
            <div className="flex items-center gap-3 mt-2">
              <span className="text-3xl font-bold text-primary">{formatPrice(listing.price)}</span>
              <PriceBadge priceDrop={listing.priceDrop} />
            </div>
            {listing.distance != null && (
              <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {formatDistance(listing.distance)} away
              </p>
            )}
          </div>

          {/* Spec grid */}
          <div className="grid grid-cols-2 gap-2">
            {specs.map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex items-center gap-2 rounded-lg border p-3">
                <Icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="text-sm font-medium truncate">{value}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button
              className="flex-1 gap-2"
              onClick={() => window.open(listing.listingUrl, "_blank", "noopener,noreferrer")}
            >
              <ExternalLink className="h-4 w-4" />
              View on {sourceLabel(listing.source)}
            </Button>
            <Button
              variant={savedCarId ? "default" : "outline"}
              size="icon"
              className={savedCarId ? "text-red-500 bg-red-50 border-red-200 hover:bg-red-100" : ""}
              onClick={handleSaveToggle}
              aria-label={savedCarId ? "Remove from saved" : "Save"}
            >
              <Heart className={`h-4 w-4 ${savedCarId ? "fill-current text-red-500" : ""}`} />
            </Button>
          </div>
        </div>
      </div>

      {/* Price history chart */}
      {priceChartData.length > 1 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-base">Price History</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={priceChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis
                  tick={{ fontSize: 12 }}
                  tickFormatter={(v) => `£${(v / 1000).toFixed(0)}k`}
                  domain={["auto", "auto"]}
                />
                <Tooltip
                  formatter={(value: number) => [formatPrice(value), "Price"]}
                />
                <Line
                  type="monotone"
                  dataKey="price"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={{ fill: "hsl(var(--primary))", r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Lightbox */}
      {lightboxOpen && images.length > 0 && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
          onClick={() => setLightboxOpen(false)}
        >
          <button
            className="absolute top-4 right-4 text-white/80 hover:text-white"
            onClick={() => setLightboxOpen(false)}
          >
            ✕
          </button>
          <div
            className="relative w-full max-w-4xl max-h-[80vh] aspect-video"
            onClick={(e) => e.stopPropagation()}
          >
            <Image
              src={images[imageIndex]}
              alt=""
              fill
              className="object-contain"
              sizes="100vw"
            />
            {images.length > 1 && (
              <>
                <button
                  className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 rounded-full p-2 text-white"
                  onClick={() => setImageIndex((i) => (i - 1 + images.length) % images.length)}
                >
                  <ChevronLeft className="h-6 w-6" />
                </button>
                <button
                  className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 rounded-full p-2 text-white"
                  onClick={() => setImageIndex((i) => (i + 1) % images.length)}
                >
                  <ChevronRight className="h-6 w-6" />
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
