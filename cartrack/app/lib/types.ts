export interface Listing {
  id: string
  title: string
  make: string
  model: string
  trim?: string | null
  year: number
  price: number
  mileage?: number | null
  fuelType?: string | null
  transmission?: string | null
  colour?: string | null
  engineSize?: string | null
  sellerType?: string | null
  location?: string | null
  distance?: number | null
  listingUrl: string
  source: string
  imageUrls: string
  vin?: string | null
  fingerprint: string
  firstSeen: Date | string
  lastSeen: Date | string
  isActive: boolean
  priceHistory?: PriceHistory[]
  savedBy?: SavedCar[]
  // computed
  priceDrop?: number
  daysOnMarket?: number
  isSaved?: boolean
}

export interface PriceHistory {
  id: string
  listingId: string
  price: number
  recordedAt: Date | string
}

export interface SavedCar {
  id: string
  listingId: string
  listing?: Listing
  notes?: string | null
  priceAtSave: number
  savedAt: Date | string
}

export interface SavedSearch {
  id: string
  name: string
  filters: string
  lastViewed: Date | string
  newCount: number
  emailAlert: boolean
  desktopAlert: boolean
  createdAt: Date | string
}

export interface Alert {
  id: string
  savedSearchId: string
  listingId: string
  sentAt: Date | string
  type: string
}

export interface Settings {
  id: number
  postcode: string
  scrapeIntervalMinutes: number
  maxResultsPerSource: number
  autotraderEnabled: boolean
  motorsEnabled: boolean
  gumtreeEnabled: boolean
  ebayEnabled: boolean
  emailEnabled: boolean
  smtpHost?: string | null
  smtpPort?: number | null
  smtpUser?: string | null
  smtpPass?: string | null
  alertEmail?: string | null
}

export interface SearchFilters {
  make?: string
  model?: string
  trim?: string
  priceMin?: number
  priceMax?: number
  yearMin?: number
  yearMax?: number
  mileageMax?: number
  fuelTypes?: string[]
  transmission?: string
  postcode?: string
  radius?: number
  sources?: string[]
  sellerType?: string
  insuranceGroupMax?: number
  sortBy?: 'price' | 'mileage' | 'year' | 'firstSeen' | 'priceDrop'
  sortOrder?: 'asc' | 'desc'
  page?: number
  limit?: number
}

export interface AnalyticsData {
  avgPriceByYearModel: { year: number; model: string; avgPrice: number; count: number }[]
  priceDistribution: { range: string; count: number }[]
  daysOnMarketDistribution: { range: string; count: number }[]
  priceDropFrequency: { make: string; dropCount: number; totalListings: number }[]
  totalListings: number
  avgPrice: number
  avgMileage: number
  sourceCounts: { source: string; count: number }[]
}

export const SOURCES = ['autotrader', 'motors', 'gumtree', 'ebay'] as const
export const FUEL_TYPES = ['Petrol', 'Diesel', 'Hybrid', 'Electric'] as const
export const TRANSMISSIONS = ['Automatic', 'Manual'] as const
export const SELLER_TYPES = ['dealer', 'private'] as const
export const MAKES = ['Audi', 'BMW', 'CUPRA', 'Honda', 'Mercedes-Benz', 'SEAT', 'Skoda', 'Toyota'] as const
