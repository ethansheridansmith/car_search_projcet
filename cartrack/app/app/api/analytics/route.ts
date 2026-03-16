import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { differenceInDays } from 'date-fns'
import type { AnalyticsData } from '@/lib/types'

export async function GET() {
  try {
    // Fetch all active listings with price history for analysis
    const allListings = await prisma.listing.findMany({
      where: { isActive: true },
      include: {
        priceHistory: {
          orderBy: { recordedAt: 'asc' },
        },
      },
    })

    // ─── totalListings, avgPrice, avgMileage ──────────────────────────────────
    const totalListings = allListings.length
    const avgPrice =
      totalListings > 0
        ? Math.round(
            allListings.reduce((sum, l) => sum + l.price, 0) / totalListings
          )
        : 0
    const listingsWithMileage = allListings.filter((l) => l.mileage != null)
    const avgMileage =
      listingsWithMileage.length > 0
        ? Math.round(
            listingsWithMileage.reduce((sum, l) => sum + (l.mileage ?? 0), 0) /
              listingsWithMileage.length
          )
        : 0

    // ─── avgPriceByYearModel ──────────────────────────────────────────────────
    const byYearModel = new Map<
      string,
      { year: number; model: string; totalPrice: number; count: number }
    >()
    for (const l of allListings) {
      const key = `${l.year}::${l.model}`
      const existing = byYearModel.get(key)
      if (existing) {
        existing.totalPrice += l.price
        existing.count++
      } else {
        byYearModel.set(key, {
          year: l.year,
          model: l.model,
          totalPrice: l.price,
          count: 1,
        })
      }
    }
    const avgPriceByYearModel = Array.from(byYearModel.values())
      .map(({ year, model, totalPrice, count }) => ({
        year,
        model,
        avgPrice: Math.round(totalPrice / count),
        count,
      }))
      .sort((a, b) => a.year - b.year || a.model.localeCompare(b.model))

    // ─── priceDistribution ────────────────────────────────────────────────────
    const priceBuckets: { range: string; min: number; max: number }[] = [
      { range: '£0–£5k', min: 0, max: 5000 },
      { range: '£5k–£10k', min: 5000, max: 10000 },
      { range: '£10k–£12k', min: 10000, max: 12000 },
      { range: '£12k–£14k', min: 12000, max: 14000 },
      { range: '£14k–£16k', min: 14000, max: 16000 },
      { range: '£16k–£18k', min: 16000, max: 18000 },
      { range: '£18k+', min: 18000, max: Infinity },
    ]
    const priceDistribution = priceBuckets.map(({ range, min, max }) => ({
      range,
      count: allListings.filter(
        (l) => l.price >= min && l.price < max
      ).length,
    }))

    // ─── daysOnMarketDistribution ─────────────────────────────────────────────
    const now = new Date()
    const domBuckets: { range: string; minDays: number; maxDays: number }[] = [
      { range: '0–7 days', minDays: 0, maxDays: 7 },
      { range: '7–14 days', minDays: 7, maxDays: 14 },
      { range: '14–30 days', minDays: 14, maxDays: 30 },
      { range: '30–60 days', minDays: 30, maxDays: 60 },
      { range: '60+ days', minDays: 60, maxDays: Infinity },
    ]
    const daysOnMarketDistribution = domBuckets.map(
      ({ range, minDays, maxDays }) => ({
        range,
        count: allListings.filter((l) => {
          const days = differenceInDays(now, new Date(l.firstSeen))
          return days >= minDays && days < maxDays
        }).length,
      })
    )

    // ─── priceDropFrequency ───────────────────────────────────────────────────
    const makeMap = new Map<
      string,
      { dropCount: number; totalListings: number }
    >()
    for (const l of allListings) {
      const entry = makeMap.get(l.make) ?? { dropCount: 0, totalListings: 0 }
      entry.totalListings++
      const history = l.priceHistory ?? []
      if (history.length > 0) {
        const maxPrevious = Math.max(...history.map((h) => h.price))
        if (maxPrevious > l.price) {
          entry.dropCount++
        }
      }
      makeMap.set(l.make, entry)
    }
    const priceDropFrequency = Array.from(makeMap.entries())
      .map(([make, { dropCount, totalListings: total }]) => ({
        make,
        dropCount,
        totalListings: total,
      }))
      .sort((a, b) => b.dropCount - a.dropCount)

    // ─── sourceCounts ─────────────────────────────────────────────────────────
    const sourceMap = new Map<string, number>()
    for (const l of allListings) {
      sourceMap.set(l.source, (sourceMap.get(l.source) ?? 0) + 1)
    }
    const sourceCounts = Array.from(sourceMap.entries())
      .map(([source, count]) => ({ source, count }))
      .sort((a, b) => b.count - a.count)

    const analyticsData: AnalyticsData = {
      avgPriceByYearModel,
      priceDistribution,
      daysOnMarketDistribution,
      priceDropFrequency,
      totalListings,
      avgPrice,
      avgMileage,
      sourceCounts,
    }

    return NextResponse.json(analyticsData)
  } catch (error) {
    console.error('GET /api/analytics error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
