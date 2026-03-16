"use client"

import * as React from "react"
import { SlidersHorizontal, RotateCcw, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Checkbox } from "@/components/ui/checkbox"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn, formatPrice, formatMileage } from "@/lib/utils"
import type { SearchFilters as SearchFiltersType } from "@/lib/types"

const MAKES = [
  "Any",
  "BMW",
  "Audi",
  "CUPRA",
  "SEAT",
  "Mercedes-Benz",
  "Skoda",
  "Toyota",
  "Honda",
]

const MAKE_MODELS: Record<string, string[]> = {
  BMW: ["1 Series", "2 Series", "3 Series", "4 Series", "5 Series", "X1", "X3", "X5"],
  Audi: ["A1", "A3", "A4", "A5", "A6", "Q2", "Q3", "Q5"],
  CUPRA: ["Born", "Formentor", "Ateca", "Leon"],
  SEAT: ["Ibiza", "Leon", "Ateca", "Tarraco"],
  "Mercedes-Benz": ["A Class", "B Class", "C Class", "E Class", "GLA", "GLB", "GLC"],
  Skoda: ["Fabia", "Octavia", "Superb", "Kodiaq", "Karoq", "Kamiq"],
  Toyota: ["Yaris", "Corolla", "C-HR", "RAV4", "Camry"],
  Honda: ["Jazz", "Civic", "HR-V", "CR-V"],
}

const FUEL_TYPES = ["Petrol", "Diesel", "Hybrid", "Electric"]
const SOURCES = [
  { value: "autotrader", label: "AutoTrader" },
  { value: "motors", label: "Motors" },
  { value: "gumtree", label: "Gumtree" },
  { value: "ebay", label: "eBay" },
]
const YEARS = Array.from({ length: 10 }, (_, i) => 2015 + i)
const RADIUS_OPTIONS = [10, 25, 50, 100]

interface SearchFiltersProps {
  filters: SearchFiltersType
  onChange: (filters: SearchFiltersType) => void
  makes?: string[]
  models?: string[]
}

export function SearchFilters({ filters, onChange }: SearchFiltersProps) {
  const [collapsed, setCollapsed] = React.useState(false)

  const update = (partial: Partial<SearchFiltersType>) => {
    onChange({ ...filters, ...partial, page: 1 })
  }

  const handleMakeChange = (value: string) => {
    update({ make: value === "Any" ? undefined : value, model: undefined })
  }

  const handleFuelToggle = (fuel: string, checked: boolean) => {
    const current = filters.fuelTypes ?? []
    if (checked) {
      update({ fuelTypes: [...current, fuel] })
    } else {
      update({ fuelTypes: current.filter((f) => f !== fuel) })
    }
  }

  const handleSourceToggle = (source: string, checked: boolean) => {
    const current = filters.sources ?? []
    if (checked) {
      update({ sources: [...current, source] })
    } else {
      update({ sources: current.filter((s) => s !== source) })
    }
  }

  const handleReset = () => {
    onChange({
      postcode: "BS7 8NE",
      radius: 50,
      priceMin: 0,
      priceMax: 30000,
      yearMin: 2015,
      yearMax: 2024,
      mileageMax: 150000,
      fuelTypes: [],
      transmission: undefined,
      sources: [],
      sellerType: undefined,
      sortBy: "price",
      sortOrder: "asc",
      page: 1,
      limit: 20,
    })
  }

  const selectedMake = filters.make ?? "Any"
  const availableModels = selectedMake !== "Any" ? (MAKE_MODELS[selectedMake] ?? []) : []

  return (
    <div className={cn("relative bg-background border rounded-xl", collapsed ? "w-auto" : "w-72")}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-2 font-semibold text-sm">
          <SlidersHorizontal className="h-4 w-4" />
          {!collapsed && "Filters"}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={() => setCollapsed((v) => !v)}
          aria-label={collapsed ? "Expand filters" : "Collapse filters"}
        >
          {collapsed ? "→" : "←"}
        </Button>
      </div>

      {!collapsed && (
        <div className="p-4 space-y-5 overflow-y-auto max-h-[calc(100vh-10rem)]">
          {/* Make */}
          <div className="space-y-1.5">
            <Label>Make</Label>
            <Select value={selectedMake} onValueChange={handleMakeChange}>
              <SelectTrigger>
                <SelectValue placeholder="Any make" />
              </SelectTrigger>
              <SelectContent>
                {MAKES.map((make) => (
                  <SelectItem key={make} value={make}>
                    {make}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Model */}
          <div className="space-y-1.5">
            <Label>Model</Label>
            <Select
              value={filters.model ?? "Any"}
              onValueChange={(v) => update({ model: v === "Any" ? undefined : v })}
              disabled={availableModels.length === 0}
            >
              <SelectTrigger>
                <SelectValue placeholder="Any model" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Any">Any model</SelectItem>
                {availableModels.map((model) => (
                  <SelectItem key={model} value={model}>
                    {model}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* Price range */}
          <div className="space-y-2">
            <div className="flex justify-between">
              <Label>Price</Label>
              <span className="text-xs text-muted-foreground">
                {formatPrice(filters.priceMin ?? 0)} – {formatPrice(filters.priceMax ?? 30000)}
              </span>
            </div>
            <Slider
              min={0}
              max={30000}
              step={500}
              value={[filters.priceMin ?? 0, filters.priceMax ?? 30000]}
              onValueChange={([min, max]) => update({ priceMin: min, priceMax: max })}
            />
          </div>

          {/* Year range */}
          <div className="space-y-1.5">
            <Label>Year</Label>
            <div className="flex gap-2">
              <Select
                value={String(filters.yearMin ?? 2015)}
                onValueChange={(v) => update({ yearMin: parseInt(v) })}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {YEARS.map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="flex items-center text-muted-foreground text-sm">to</span>
              <Select
                value={String(filters.yearMax ?? 2024)}
                onValueChange={(v) => update({ yearMax: parseInt(v) })}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {YEARS.map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Max mileage */}
          <div className="space-y-2">
            <div className="flex justify-between">
              <Label>Max Mileage</Label>
              <span className="text-xs text-muted-foreground">
                {filters.mileageMax != null && filters.mileageMax < 150000
                  ? `Up to ${formatMileage(filters.mileageMax)}`
                  : "Any"}
              </span>
            </div>
            <Slider
              min={0}
              max={150000}
              step={5000}
              value={[filters.mileageMax ?? 150000]}
              onValueChange={([v]) => update({ mileageMax: v })}
            />
          </div>

          <Separator />

          {/* Fuel type */}
          <div className="space-y-2">
            <Label>Fuel Type</Label>
            <div className="grid grid-cols-2 gap-2">
              {FUEL_TYPES.map((fuel) => (
                <div key={fuel} className="flex items-center gap-2">
                  <Checkbox
                    id={`fuel-${fuel}`}
                    checked={(filters.fuelTypes ?? []).includes(fuel)}
                    onCheckedChange={(checked) => handleFuelToggle(fuel, !!checked)}
                  />
                  <label htmlFor={`fuel-${fuel}`} className="text-sm cursor-pointer">
                    {fuel}
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* Transmission */}
          <div className="space-y-2">
            <Label>Transmission</Label>
            <div className="flex gap-2">
              {["Any", "Automatic", "Manual"].map((t) => (
                <button
                  key={t}
                  onClick={() => update({ transmission: t === "Any" ? undefined : t })}
                  className={cn(
                    "flex-1 py-1.5 px-2 rounded-md text-xs border transition-colors",
                    (filters.transmission === t) || (t === "Any" && !filters.transmission)
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background hover:bg-accent border-input"
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <Separator />

          {/* Postcode + radius */}
          <div className="space-y-1.5">
            <Label>Location</Label>
            <div className="flex gap-2">
              <Input
                placeholder="Postcode"
                value={filters.postcode ?? "BS7 8NE"}
                onChange={(e) => update({ postcode: e.target.value })}
                className="flex-1"
              />
              <Select
                value={String(filters.radius ?? 50)}
                onValueChange={(v) => update({ radius: parseInt(v) })}
              >
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RADIUS_OPTIONS.map((r) => (
                    <SelectItem key={r} value={String(r)}>
                      {r} mi
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          {/* Sources */}
          <div className="space-y-2">
            <Label>Sources</Label>
            <div className="grid grid-cols-2 gap-2">
              {SOURCES.map(({ value, label }) => (
                <div key={value} className="flex items-center gap-2">
                  <Checkbox
                    id={`source-${value}`}
                    checked={(filters.sources ?? []).includes(value)}
                    onCheckedChange={(checked) => handleSourceToggle(value, !!checked)}
                  />
                  <label htmlFor={`source-${value}`} className="text-sm cursor-pointer">
                    {label}
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* Seller type */}
          <div className="space-y-2">
            <Label>Seller Type</Label>
            <div className="flex gap-2">
              {["Any", "dealer", "private"].map((t) => (
                <button
                  key={t}
                  onClick={() => update({ sellerType: t === "Any" ? undefined : t })}
                  className={cn(
                    "flex-1 py-1.5 px-2 rounded-md text-xs border transition-colors capitalize",
                    (filters.sellerType === t) || (t === "Any" && !filters.sellerType)
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background hover:bg-accent border-input"
                  )}
                >
                  {t === "dealer" ? "Dealer" : t === "private" ? "Private" : "Any"}
                </button>
              ))}
            </div>
          </div>

          <Separator />

          {/* Insurance group */}
          <div className="space-y-2">
            <div className="flex justify-between">
              <Label>Max Insurance Group</Label>
              <span className="text-xs text-muted-foreground">
                {filters.insuranceGroupMax != null && filters.insuranceGroupMax < 50
                  ? `Up to ${filters.insuranceGroupMax}`
                  : "Any"}
              </span>
            </div>
            <Slider
              min={1}
              max={50}
              step={1}
              value={[filters.insuranceGroupMax ?? 50]}
              onValueChange={([v]) => update({ insuranceGroupMax: v })}
            />
          </div>

          <Separator />

          {/* Sort */}
          <div className="space-y-1.5">
            <Label>Sort By</Label>
            <Select
              value={`${filters.sortBy ?? "price"}_${filters.sortOrder ?? "asc"}`}
              onValueChange={(v) => {
                const [sortBy, sortOrder] = v.split("_")
                update({ sortBy, sortOrder })
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="price_asc">Price: Low to High</SelectItem>
                <SelectItem value="price_desc">Price: High to Low</SelectItem>
                <SelectItem value="mileage_asc">Mileage: Lowest</SelectItem>
                <SelectItem value="year_desc">Year: Newest</SelectItem>
                <SelectItem value="firstSeen_desc">Date Added: Newest</SelectItem>
                <SelectItem value="priceDrop_desc">Biggest Price Drop</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Buttons */}
          <div className="flex gap-2 pt-2">
            <Button className="flex-1" size="sm" onClick={() => onChange({ ...filters, page: 1 })}>
              <Check className="h-3.5 w-3.5 mr-1" />
              Apply
            </Button>
            <Button variant="outline" size="sm" onClick={handleReset}>
              <RotateCcw className="h-3.5 w-3.5 mr-1" />
              Reset
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
