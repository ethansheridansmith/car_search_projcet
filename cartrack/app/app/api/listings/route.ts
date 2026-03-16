import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { differenceInDays } from 'date-fns'
import type { Prisma } from '@prisma/client'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl

    const make = searchParams.get('make') ?? undefined
    const model = searchParams.get('model') ?? undefined
    const trim = searchParams.get('trim') ?? undefined
    const priceMin = searchParams.get('priceMin') ? Number(searchParams.get('priceMin')) : undefined
    const priceMax = searchParams.get('priceMax') ? Number(searchParams.get('priceMax')) : undefined
    const yearMin = searchParams.get('yearMin') ? Number(searchParams.get('yearMin')) : undefined
    const yearMax = searchParams.get('yearMax') ? Number(searchParams.get('yearMax')) : undefined
    const mileageMax = searchParams.get('mileageMax') ? Number(searchParams.get('mileageMax')) : undefined
    const fuelTypesRaw = searchParams.get('fuelTypes')
    const fuelTypes = fuelTypesRaw ? fuelTypesRaw.split(',').filter(Boolean) : undefined
    const transmission = searchParams.get('transmission') ?? undefined
    const sourcesRaw = searchParams.get('sources')
    const sources = sourcesRaw ? sourcesRaw.split(',').filter(Boolean) : undefined
    const sellerType = searchParams.get('sellerType') ?? undefined
    const sortBy = (searchParams.get('sortBy') as 'price' | 'mileage' | 'year' | 'firstSeen' | 'priceDrop') ?? 'firstSeen'
    const sortOrder = (searchParams.get('sortOrder') as 'asc' | 'desc') ?? 'desc'
    const page = searchParams.get('page') ? Math.max(1, Number(searchParams.get('page'))) : 1
    const limit = searchParams.get('limit') ? Math.min(100, Number(searchParams.get('limit'))) : 20

    // Build WHERE clause
    const where: Prisma.ListingWhereInput = {
      isActive: true,
    }

    if (make) where.make = { equals: make }
    if (model) where.model = { contains: model }
    if (trim) where.trim = { contains: trim }
    if (priceMin !== undefined || priceMax !== undefined) {
      where.price = {}
      if (priceMin !== undefined) (where.price as Prisma.IntFilter).gte = priceMin
      if (priceMax !== undefined) (where.price as Prisma.IntFilter).lte = priceMax
    }
    if (yearMin !== undefined || yearMax !== undefined) {
      where.year = {}
      if (yearMin !== undefined) (where.year as Prisma.IntFilter).gte = yearMin
      if (yearMax !== undefined) (where.year as Prisma.IntFilter).lte = yearMax
    }
    if (mileageMax !== undefined) {
      where.mileage = { lte: mileageMax }
    }
    if (fuelTypes && fuelTypes.length > 0) {
      where.fuelType = { in: fuelTypes }
    }
    if (transmission) where.transmission = { equals: transmission }
    if (sources && sources.length > 0) {
      where.source = { in: sources }
    }
    if (sellerType) where.sellerType = { equals: sellerType }

    // Build ORDER BY — for priceDrop we'll sort post-query
    const prismaOrderBy: Prisma.ListingOrderByWithRelationInput =
      sortBy === 'priceDrop'
        ? { price: 'asc' } // fallback; real sort done in-memory
        : { [sortBy]: sortOrder }

    const skip = (page - 1) * limit

    const [rawListings, total] = await Promise.all([
      prisma.listing.findMany({
        where,
        orderBy: prismaOrderBy,
        skip: sortBy === 'priceDrop' ? 0 : skip,
        take: sortBy === 'priceDrop' ? undefined : limit,
        include: {
          priceHistory: {
            orderBy: { recordedAt: 'asc' },
          },
        },
      }),
      prisma.listing.count({ where }),
    ])

    // Enrich with computed fields
    const now = new Date()
    const enriched = rawListings.map((listing) => {
      const history = listing.priceHistory ?? []
      let priceDrop = 0
      if (history.length > 0) {
        const maxPrevious = Math.max(...history.map((h) => h.price))
        if (maxPrevious > listing.price) {
          priceDrop = maxPrevious - listing.price
        }
      }
      const daysOnMarketVal = differenceInDays(now, new Date(listing.firstSeen))
      return {
        ...listing,
        priceDrop,
        daysOnMarket: daysOnMarketVal,
      }
    })

    // Handle priceDrop sort in-memory
    let results = enriched
    if (sortBy === 'priceDrop') {
      results = enriched.sort((a, b) =>
        sortOrder === 'desc' ? b.priceDrop - a.priceDrop : a.priceDrop - b.priceDrop
      )
      results = results.slice(skip, skip + limit)
    }

    const totalPages = Math.ceil(total / limit)

    return NextResponse.json({
      listings: results,
      total,
      page,
      totalPages,
    })
  } catch (error) {
    console.error('GET /api/listings error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
