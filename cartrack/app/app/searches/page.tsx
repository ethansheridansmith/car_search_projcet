"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { BookMarked, Bell, BellOff, Trash2, ExternalLink, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { useToast } from "@/components/ui/use-toast"
import type { SavedSearch, SearchFilters as SearchFiltersType } from "@/lib/types"

function formatFilterSummary(filtersJson: string): string {
  try {
    const f: SearchFiltersType = JSON.parse(filtersJson)
    const parts: string[] = []
    if (f.make) parts.push(f.make)
    if (f.model) parts.push(f.model)
    if (f.transmission) parts.push(f.transmission)
    if (f.priceMin != null || f.priceMax != null) {
      const min = f.priceMin != null ? `£${(f.priceMin / 1000).toFixed(0)}k` : "£0"
      const max = f.priceMax != null ? `£${(f.priceMax / 1000).toFixed(0)}k` : "any"
      parts.push(`${min}–${max}`)
    }
    if (f.yearMin != null) parts.push(`${f.yearMin}+`)
    if (f.fuelTypes?.length) parts.push(f.fuelTypes.join("/"))
    if (f.mileageMax != null) parts.push(`<${(f.mileageMax / 1000).toFixed(0)}k mi`)
    return parts.join(" · ") || "No filters"
  } catch {
    return "Custom filters"
  }
}

function formatDate(d: Date | string) {
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
}

export default function SearchesPage() {
  const { toast } = useToast()
  const router = useRouter()
  const [searches, setSearches] = React.useState<SavedSearch[]>([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    fetchSearches()
  }, [])

  async function fetchSearches() {
    setLoading(true)
    try {
      const res = await fetch("/api/searches")
      if (!res.ok) throw new Error()
      const data = await res.json()
      setSearches(data.searches ?? data ?? [])
    } catch {
      toast({ title: "Error", description: "Failed to load searches", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  async function handleToggleAlert(searchId: string, field: "emailAlert" | "desktopAlert", value: boolean) {
    try {
      const res = await fetch(`/api/searches/${searchId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      })
      if (!res.ok) throw new Error()
      setSearches((prev) =>
        prev.map((s) => (s.id === searchId ? { ...s, [field]: value } : s))
      )
    } catch {
      toast({ title: "Error", description: "Failed to update alert", variant: "destructive" })
    }
  }

  async function handleDelete(searchId: string) {
    try {
      const res = await fetch(`/api/searches/${searchId}`, { method: "DELETE" })
      if (!res.ok) throw new Error()
      setSearches((prev) => prev.filter((s) => s.id !== searchId))
      toast({ title: "Deleted", description: "Saved search removed" })
    } catch {
      toast({ title: "Error", description: "Failed to delete search", variant: "destructive" })
    }
  }

  function handleSearchNow(search: SavedSearch) {
    try {
      const filters: SearchFiltersType = JSON.parse(search.filters)
      const params = new URLSearchParams()
      if (filters.make) params.set("make", filters.make)
      if (filters.model) params.set("model", filters.model)
      if (filters.priceMax != null) params.set("priceMax", String(filters.priceMax))
      if (filters.yearMin != null) params.set("yearMin", String(filters.yearMin))
      if (filters.transmission) params.set("transmission", filters.transmission)
      if (filters.fuelTypes?.length) params.set("fuelTypes", filters.fuelTypes.join(","))
      if (filters.postcode) params.set("postcode", filters.postcode)
      router.push(`/search?${params.toString()}`)
    } catch {
      router.push("/search")
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-6 max-w-3xl">
        <Skeleton className="h-8 w-48 mb-6" />
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Saved Searches</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {searches.length} saved {searches.length === 1 ? "search" : "searches"}
          </p>
        </div>
        <Button asChild size="sm">
          <Link href="/search">
            <Plus className="h-4 w-4 mr-1" />
            New search
          </Link>
        </Button>
      </div>

      {searches.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <BookMarked className="h-12 w-12 text-muted-foreground/30 mb-4" />
          <h3 className="text-lg font-semibold mb-1">No saved searches</h3>
          <p className="text-muted-foreground text-sm mb-6">
            Save a search on the search page to get notified of new listings.
          </p>
          <Button asChild>
            <Link href="/search">Go to search</Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {searches.map((search) => (
            <Card key={search.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3 className="font-semibold text-base">{search.name}</h3>
                      {search.newCount > 0 && (
                        <Badge className="bg-green-100 text-green-700 border-green-200 text-xs">
                          {search.newCount} new
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mb-3">
                      {formatFilterSummary(search.filters)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Created {formatDate(search.createdAt)}
                      {search.lastViewed && ` · Last viewed ${formatDate(search.lastViewed)}`}
                    </p>
                  </div>

                  {/* Delete button */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => handleDelete(search.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                <Separator className="my-3" />

                <div className="flex items-center justify-between flex-wrap gap-3">
                  {/* Alert toggles */}
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Switch
                        id={`email-${search.id}`}
                        checked={search.emailAlert}
                        onCheckedChange={(checked) => handleToggleAlert(search.id, "emailAlert", checked)}
                      />
                      <Label htmlFor={`email-${search.id}`} className="text-xs cursor-pointer flex items-center gap-1">
                        {search.emailAlert
                          ? <Bell className="h-3 w-3 text-primary" />
                          : <BellOff className="h-3 w-3 text-muted-foreground" />
                        }
                        Email
                      </Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        id={`desktop-${search.id}`}
                        checked={search.desktopAlert}
                        onCheckedChange={(checked) => handleToggleAlert(search.id, "desktopAlert", checked)}
                      />
                      <Label htmlFor={`desktop-${search.id}`} className="text-xs cursor-pointer flex items-center gap-1">
                        {search.desktopAlert
                          ? <Bell className="h-3 w-3 text-primary" />
                          : <BellOff className="h-3 w-3 text-muted-foreground" />
                        }
                        Desktop
                      </Label>
                    </div>
                  </div>

                  {/* Search now button */}
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 text-xs"
                    onClick={() => handleSearchNow(search)}
                  >
                    <ExternalLink className="h-3 w-3" />
                    Search now
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
