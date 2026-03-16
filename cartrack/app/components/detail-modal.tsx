"use client"

import { useState } from 'react'
import Image from 'next/image'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { SourceBadge } from './source-badge'
import { PriceBadge } from './price-badge'
import {
  formatPrice, formatMileage, daysOnMarket, getImageUrls,
  fuelTypeColor, timeAgo,
} from '@/lib/utils'
import type { Listing } from '@/lib/types'
import {
  Heart, ExternalLink, ChevronLeft, ChevronRight,
  Calendar, Gauge, Fuel, Settings2, Palette, Car,
  MapPin, User, Tag, Clock,
} from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts'
import { format } from 'date-fns'

interface DetailModalProps {
  listing: Listing | null
  open: boolean
  onClose: () => void
  isSaved?: boolean
  onSave?: (listingId: string) => void
  onUnsave?: (listingId: string) => void
}

export function DetailModal({
  listing, open, onClose, isSaved, onSave, onUnsave,
}: DetailModalProps) {
  const [imageIndex, setImageIndex] = useState(0)

  if (!listing) return null

  const images = getImageUrls(listing.imageUrls)
  const days = daysOnMarket(listing.firstSeen)

  // Build price history chart data
  const priceData = [
    ...(listing.priceHistory ?? [])
      .slice()
      .sort((a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime())
      .map(h => ({
        date: format(new Date(h.recordedAt), 'dd MMM'),
        price: h.price,
      })),
  ]
  // Ensure current price is the last point
  if (priceData.length === 0 || priceData[priceData.length - 1].price !== listing.price) {
    priceData.push({ date: 'Now', price: listing.price })
  }

  const specs: { icon: React.ReactNode; label: string; value: string | number | null | undefined }[] = [
    { icon: <Calendar className="h-4 w-4" />, label: 'Year', value: listing.year },
    { icon: <Gauge className="h-4 w-4" />, label: 'Mileage', value: listing.mileage ? formatMileage(listing.mileage) : null },
    { icon: <Fuel className="h-4 w-4" />, label: 'Fuel Type', value: listing.fuelType },
    { icon: <Settings2 className="h-4 w-4" />, label: 'Transmission', value: listing.transmission },
    { icon: <Palette className="h-4 w-4" />, label: 'Colour', value: listing.colour },
    { icon: <Car className="h-4 w-4" />, label: 'Engine', value: listing.engineSize },
    { icon: <User className="h-4 w-4" />, label: 'Seller', value: listing.sellerType ? (listing.sellerType === 'dealer' ? 'Dealer' : 'Private') : null },
    { icon: <MapPin className="h-4 w-4" />, label: 'Location', value: listing.location },
    { icon: <Tag className="h-4 w-4" />, label: 'VIN', value: listing.vin },
    { icon: <Clock className="h-4 w-4" />, label: 'First Seen', value: timeAgo(listing.firstSeen) },
  ]

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-0">
        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-0">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-lg font-semibold leading-tight pr-2">
                {listing.title}
              </DialogTitle>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <SourceBadge source={listing.source} />
                {listing.priceDrop && listing.priceDrop > 0 && (
                  <PriceBadge priceDrop={listing.priceDrop} />
                )}
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {days === 0 ? 'Listed today' : `${days} days on market`}
                </span>
              </div>
            </div>
            <p className="text-2xl font-bold text-primary whitespace-nowrap">
              {formatPrice(listing.price)}
            </p>
          </div>
        </DialogHeader>

        <div className="px-6 pb-6 space-y-5 mt-4">
          {/* Image Gallery */}
          {images.length > 0 ? (
            <div className="relative rounded-lg overflow-hidden bg-gray-100" style={{ height: 280 }}>
              <Image
                src={images[imageIndex]}
                alt={listing.title}
                fill
                className="object-cover"
              />
              {images.length > 1 && (
                <>
                  <button
                    onClick={() => setImageIndex(i => (i - 1 + images.length) % images.length)}
                    className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/40 hover:bg-black/60 text-white transition"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => setImageIndex(i => (i + 1) % images.length)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/40 hover:bg-black/60 text-white transition"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                    {images.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setImageIndex(i)}
                        className={`w-2 h-2 rounded-full transition ${i === imageIndex ? 'bg-white' : 'bg-white/50'}`}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-48 rounded-lg bg-gray-100 text-gray-400">
              <Car className="h-16 w-16" />
            </div>
          )}

          {/* Spec Grid */}
          <div>
            <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">
              Specifications
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {specs.filter(s => s.value != null && s.value !== '').map(spec => (
                <div key={spec.label} className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground flex-shrink-0">{spec.icon}</span>
                  <span className="text-muted-foreground">{spec.label}:</span>
                  <span className="font-medium truncate">{spec.value}</span>
                </div>
              ))}
              {listing.distance != null && (
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <span className="text-muted-foreground">Distance:</span>
                  <span className="font-medium">{listing.distance.toFixed(1)} mi</span>
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Price History Chart */}
          {priceData.length > 1 && (
            <div>
              <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">
                Price History
              </h3>
              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={priceData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis
                    tickFormatter={(v) => `£${(v / 1000).toFixed(0)}k`}
                    tick={{ fontSize: 11 }}
                    domain={['auto', 'auto']}
                  />
                  <Tooltip formatter={(v: number) => [formatPrice(v), 'Price']} />
                  <Line
                    type="monotone"
                    dataKey="price"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          <Separator />

          {/* Actions */}
          <div className="flex items-center gap-3 pt-1">
            <Button
              variant={isSaved ? 'secondary' : 'outline'}
              onClick={() => isSaved ? onUnsave?.(listing.id) : onSave?.(listing.id)}
              className="flex items-center gap-2"
            >
              <Heart className={`h-4 w-4 ${isSaved ? 'fill-red-500 text-red-500' : ''}`} />
              {isSaved ? 'Saved' : 'Save Car'}
            </Button>
            <a
              href={listing.listingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1"
            >
              <Button className="w-full flex items-center gap-2">
                <ExternalLink className="h-4 w-4" />
                View on {listing.source.charAt(0).toUpperCase() + listing.source.slice(1)}
              </Button>
            </a>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
