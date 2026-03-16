"use client"

import * as React from "react"
import { LayoutGrid, Table, BookmarkPlus, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SearchFilters } from "@/components/search-filters"
import { ListingCard } from "@/components/listing-card"
import { ListingTable } from "@/components/listing-table"
import { useToast } from "@/components/ui/use-toast"
import type { Listing, SearchFilters as SearchFiltersType } from "@/lib/types"
import { cn } from "@/lib/utils"

const DEFAULT_FILTERS: SearchFiltersType = {
  postcode: "BS7 8NE",
  radius: 50,
  priceMax: 18000,
  yearMin: 2019,
  transmission: "Automatic",
  fuelTypes: ["Petrol", "Diesel", "Hybrid"],
  sortBy: "price",
  sortOrder: "asc",
  page: 1,
  limit: 20,
}

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
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-full" />
        </div>
        <Skeleton className="h-8 w-full" />
      </div>
    </div>
  )
}

export default function SearchPage() {
  const { toast } = useToast()
  const [filters, setFilters] = React.useState<SearchFiltersType>(DEFAULT_FILTERS)
  const [listings, setListings] = React.useState<Listing[]>([])
  const [total, setTotal] = React.useState(0)
  const [loading, setLoading] = React.useState(false)
  const [viewMode, setViewMode] = React.useState<"grid" | "table">("grid")
  const [savedCarIds, setSavedCarIds] = React.useState<Record<string, string>>({})
  const [scraperOnline, setScraperOnline] = React.useState<boolean | null>(null)
  const [saveSearchOpen, setSaveSearchOpen] = React.useState(false)
  const [saveSearchName, setSaveSearchName] = React.useState("")
  const [savingSearch, setSavingSearch] = React.useState(false)

  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  // Check scraper status
  React.useEffect(() => {
    fetch("/api/scrape")
      .then((r) => { setScraperOnline(r.ok) })
      .catch(() => setScraperOnline(false))
  }, [])

  // Load saved car IDs
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

  // Fetch listings (debounced)
  React.useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      fetchListings(filters)
    }, 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [filters])

  async function fetchListings(f: SearchFiltersType) {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (f.make) params.set("make", f.make)
      if (f.model) params.set("model", f.model)
      if (f.priceMin != null) params.set("priceMin", String(f.priceMin))
      if (f.priceMax != null) params.set("priceMax", String(f.priceMax))
      if (f.yearMin != null) params.set("yearMin", String(f.yearMin))
      if (f.yearMax != null) params.set("yearMax", String(f.yearMax))
      if (f.mileageMax != null) params.set("mileageMax", String(f.mileageMax))
      if (f.fuelTypes?.length) params.set("fuelTypes", f.fuelTypes.join(","))
      if (f.transmission) params.set("transmission", f.transmission)
      if (f.postcode) params.set("postcode", f.postcode)
      if (f.radius != null) params.set("radius", String(f.radius))
      if (f.sources?.length) params.set("sources", f.sources.join(","))
      if (f.sellerType) params.set("sellerType", f.sellerType)
      if (f.sortBy) params.set("sortBy", f.sortBy)
      if (f.sortOrder) params.set("sortOrder", f.sortOrder)
      if (f.page != null) params.set("page", String(f.page))
      if (f.limit != null) params.set("limit", String(f.limit))

      const res = await fetch(`/api/listings?${params.toString()}`)
      if (!res.ok) throw new Error("Failed to fetch")
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
      toast({ title: "Saved", description: `${listing.make} ${listing.model} added to saved` })
    } catch {
      toast({ title: "Error", description: "Failed to save listing", variant: "destructive" })
    }
  }

  async function handleUnsave(savedCarId: string) {
    try {
      const listingId = Object.entries(savedCarIds).find(([, v]) => v === savedCarId)?.[0]
      const res = await fetch(`/api/saved/${savedCarId}`, { method: "DELETE" })
      if (!res.ok) throw new Error()
      if (listingId) {
        setSavedCarIds((prev) => {
          const next = { ...prev }
          delete next[listingId]
          return next
        })
      }
      toast({ title: "Removed", description: "Removed from saved cars" })
    } catch {
      toast({ title: "Error", description: "Failed to remove", variant: "destructive" })
    }
  }

  async function handleSaveSearch() {
    if (!saveSearchName.trim()) return
    setSavingSearch(true)
    try {
      const res = await fetch("/api/searches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: saveSearchName, filters: JSON.stringify(filters) }),
      })
      if (!res.ok) throw new Error()
      toast({ title: "Search saved", description: `"${saveSearchName}" has been saved` })
      setSaveSearchOpen(false)
      setSaveSearchName("")
    } catch {
      toast({ title: "Error", description: "Failed to save search", variant: "destructive" })
    } finally {
      setSavingSearch(false)
    }
  }

  const totalPages = Math.ceil(total / (filters.limit ?? 20))
  const currentPage = filters.page ?? 1

  return (
    <div className="flex min-h-screen bg-background">
      {/* Filters sidebar */}
      <aside className="hidden lg:block sticky top-14 h-[calc(100vh-3.5rem)] overflow-hidden shrink-0">
        <SearchFilters filters={filters} onChange={setFilters} />
      </aside>

      {/* Main content */}
      <main className="flex-1 p-4 lg:p-6 min-w-0">
        {/* Scraper offline banner */}
        {scraperOnline === false && (
          <div className="flex items-center gap-2 mb-4 p-3 rounded-lg bg-yellow-50 border border-yellow-200 text-yellow-800 text-sm">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            Scraper is offline. Results may be outdated.
          </div>
        )}

        {/* Header bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {loading ? "Loading..." : `${total.toLocaleString()} results`}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSaveSearchOpen(true)}
              className="gap-1.5"
            >
              <BookmarkPlus className="h-4 w-4" />
              Save search
            </Button>
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
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
            <div className="text-5xl mb-4">🔍</div>
            <h3 className="text-lg font-semibold mb-1">No listings found</h3>
            <p className="text-muted-foreground text-sm max-w-md">
              Try adjusting your filters to see more results.
            </p>
          </div>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
              disabled={currentPage <= 1}
              onClick={() => setFilters((f) => ({ ...f, page: (f.page ?? 1) - 1 }))}
            >
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage >= totalPages}
              onClick={() => setFilters((f) => ({ ...f, page: (f.page ?? 1) + 1 }))}
            >
              Next
            </Button>
          </div>
        )}
      </main>

      {/* Save search dialog */}
      <Dialog open={saveSearchOpen} onOpenChange={setSaveSearchOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Save this search</DialogTitle>
            <DialogDescription>
              Give this search a name to save it for later.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="search-name">Search name</Label>
              <Input
                id="search-name"
                placeholder="e.g. BMW 3 Series Auto"
                value={saveSearchName}
                onChange={(e) => setSaveSearchName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSaveSearch()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveSearchOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveSearch} disabled={savingSearch || !saveSearchName.trim()}>
              {savingSearch ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
