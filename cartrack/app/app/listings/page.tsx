"use client"

import * as React from "react"
import { LayoutGrid, Table, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { ListingCard } from "@/components/listing-card"
import { ListingTable } from "@/components/listing-table"
import { useToast } from "@/components/ui/use-toast"
import type { Listing } from "@/lib/types"

function SkeletonCard() {
  return (
    <div className="rounded-xl border overflow-hidden">
      <Skeleton className="h-48 w-full" />
      <div className="p-4 space-y-3">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-6 w-1/2" />
        <div className="grid grid-cols-2 gap-2">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-full" />
        </div>
        <Skeleton className="h-8 w-full" />
      </div>
    </div>
  )
}

export default function ListingsPage() {
  const { toast } = useToast()
  const [listings, setListings] = React.useState<Listing[]>([])
  const [total, setTotal] = React.useState(0)
  const [loading, setLoading] = React.useState(true)
  const [searchQuery, setSearchQuery] = React.useState("")
  const [viewMode, setViewMode] = React.useState<"grid" | "table">("grid")
  const [page, setPage] = React.useState(1)
  const [savedCarIds, setSavedCarIds] = React.useState<Record<string, string>>({})
  const limit = 24

  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  React.useEffect(() => {
    fetch("/api/saved")
      .then((r) => r.json())
      .then((data) => {
        const map: Record<string, string> = {}
        ;(data.savedCars ?? data ?? []).forEach((sc: { id: string; listingId: string }) => {
          map[sc.listingId] = sc.id
        })
        setSavedCarIds(map)
      })
      .catch(() => {})
  }, [])

  React.useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      fetchListings()
    }, 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [searchQuery, page])

  async function fetchListings() {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      })
      if (searchQuery.trim()) params.set("q", searchQuery.trim())

      const res = await fetch(`/api/listings?${params.toString()}`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      setListings(data.listings ?? data ?? [])
      setTotal(data.total ?? (data.listings ?? data ?? []).length)
    } catch {
      toast({ title: "Error", description: "Failed to load listings", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  async function handleSave(listing: Listing) {
    try {
      const res = await fetch("/api/saved", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId: listing.id, priceAtSave: listing.price }),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setSavedCarIds((prev) => ({ ...prev, [listing.id]: data.id ?? data.savedCar?.id }))
      toast({ title: "Saved", description: `${listing.make} ${listing.model} saved` })
    } catch {
      toast({ title: "Error", description: "Failed to save", variant: "destructive" })
    }
  }

  async function handleUnsave(savedCarId: string) {
    try {
      const listingId = Object.entries(savedCarIds).find(([, v]) => v === savedCarId)?.[0]
      await fetch(`/api/saved/${savedCarId}`, { method: "DELETE" })
      if (listingId) {
        setSavedCarIds((prev) => {
          const next = { ...prev }
          delete next[listingId]
          return next
        })
      }
      toast({ title: "Removed", description: "Removed from saved" })
    } catch {
      toast({ title: "Error", description: "Failed to remove", variant: "destructive" })
    }
  }

  const totalPages = Math.ceil(total / limit)

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">All Listings</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {loading ? "Loading..." : `${total.toLocaleString()} listings`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search make, model..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                setPage(1)
              }}
              className="pl-8 w-56"
            />
          </div>
          <div className="flex border rounded-md overflow-hidden">
            <Button
              variant={viewMode === "grid" ? "secondary" : "ghost"}
              size="sm"
              className="rounded-none border-0"
              onClick={() => setViewMode("grid")}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "table" ? "secondary" : "ghost"}
              size="sm"
              className="rounded-none border-0"
              onClick={() => setViewMode("table")}
            >
              <Table className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Results */}
      {loading ? (
        viewMode === "grid" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        )
      ) : listings.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="text-5xl mb-4">🚗</div>
          <h3 className="text-lg font-semibold mb-1">No listings found</h3>
          <p className="text-muted-foreground text-sm">
            {searchQuery ? "Try a different search term." : "Run the scraper to populate listings."}
          </p>
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {listings.map((listing) => (
            <ListingCard
              key={listing.id}
              listing={listing}
              onSave={handleSave}
              onUnsave={handleUnsave}
              savedCarId={savedCarIds[listing.id]}
            />
          ))}
        </div>
      ) : (
        <ListingTable
          listings={listings}
          savedCarIds={savedCarIds}
          onSave={handleSave}
          onUnsave={handleUnsave}
        />
      )}

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-8">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </Button>
          <div className="flex items-center gap-1">
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              const p = i + 1
              return (
                <Button
                  key={p}
                  variant={p === page ? "default" : "outline"}
                  size="sm"
                  className="w-9"
                  onClick={() => setPage(p)}
                >
                  {p}
                </Button>
              )
            })}
            {totalPages > 7 && <span className="text-muted-foreground text-sm">...</span>}
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  )
}
