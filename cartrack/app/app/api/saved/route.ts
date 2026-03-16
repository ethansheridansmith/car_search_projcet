import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const savedCars = await prisma.savedCar.findMany({
      orderBy: { savedAt: 'desc' },
      include: {
        listing: {
          include: {
            priceHistory: {
              orderBy: { recordedAt: 'asc' },
            },
          },
        },
      },
    })

    // Enrich listings with priceDrop
    const enriched = savedCars.map((savedCar) => {
      if (!savedCar.listing) return savedCar

      const history = savedCar.listing.priceHistory ?? []
      let priceDrop = 0
      if (history.length > 0) {
        const maxPrevious = Math.max(...history.map((h) => h.price))
        if (maxPrevious > savedCar.listing.price) {
          priceDrop = maxPrevious - savedCar.listing.price
        }
      }

      // Price change since save
      const priceSinceSave = savedCar.priceAtSave - savedCar.listing.price

      return {
        ...savedCar,
        listing: {
          ...savedCar.listing,
          priceDrop,
          isSaved: true,
        },
        priceSinceSave,
      }
    })

    return NextResponse.json(enriched)
  } catch (error) {
    console.error('GET /api/saved error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { listingId, notes } = body as { listingId: string; notes?: string }

    if (!listingId) {
      return NextResponse.json(
        { error: 'listingId is required' },
        { status: 400 }
      )
    }

    // Check the listing exists
    const listing = await prisma.listing.findUnique({
      where: { id: listingId },
    })

    if (!listing) {
      return NextResponse.json(
        { error: 'Listing not found' },
        { status: 404 }
      )
    }

    // Check if already saved
    const existing = await prisma.savedCar.findFirst({
      where: { listingId },
    })

    if (existing) {
      return NextResponse.json(
        { error: 'Listing already saved' },
        { status: 409 }
      )
    }

    const savedCar = await prisma.savedCar.create({
      data: {
        listingId,
        notes: notes ?? null,
        priceAtSave: listing.price,
      },
      include: {
        listing: true,
      },
    })

    return NextResponse.json(savedCar, { status: 201 })
  } catch (error) {
    console.error('POST /api/saved error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
