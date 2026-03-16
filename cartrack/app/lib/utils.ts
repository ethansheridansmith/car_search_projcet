import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { formatDistanceToNow, differenceInDays } from 'date-fns'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatPrice(price: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: 0,
  }).format(price)
}

export function formatMileage(mileage: number): string {
  return new Intl.NumberFormat('en-GB').format(mileage) + ' miles'
}

export function formatDistance(distance: number): string {
  return `${distance.toFixed(1)} miles`
}

export function daysOnMarket(firstSeen: Date | string): number {
  return differenceInDays(new Date(), new Date(firstSeen))
}

export function timeAgo(date: Date | string): string {
  return formatDistanceToNow(new Date(date), { addSuffix: true })
}

export function getImageUrls(imageUrlsJson: string): string[] {
  try {
    return JSON.parse(imageUrlsJson)
  } catch {
    return []
  }
}

export function sourceLabel(source: string): string {
  const labels: Record<string, string> = {
    autotrader: 'AutoTrader',
    motors: 'Motors',
    gumtree: 'Gumtree',
    ebay: 'eBay',
  }
  return labels[source] ?? source
}

export function sourceColor(source: string): string {
  const colors: Record<string, string> = {
    autotrader: 'bg-orange-100 text-orange-800',
    motors: 'bg-blue-100 text-blue-800',
    gumtree: 'bg-green-100 text-green-800',
    ebay: 'bg-yellow-100 text-yellow-800',
  }
  return colors[source] ?? 'bg-gray-100 text-gray-800'
}

export function fuelTypeColor(fuelType: string): string {
  const colors: Record<string, string> = {
    Petrol: 'bg-red-100 text-red-800',
    Diesel: 'bg-gray-100 text-gray-800',
    Hybrid: 'bg-green-100 text-green-800',
    Electric: 'bg-blue-100 text-blue-800',
  }
  return colors[fuelType] ?? 'bg-gray-100 text-gray-800'
}
