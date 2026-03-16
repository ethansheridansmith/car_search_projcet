import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { differenceInDays } from 'date-fns'

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    const listing = await prisma.listing.findUnique({
      where: { id },
      include: {
        priceHistory: {
          orderBy: { recordedAt: 'asc' },
        },
        savedBy: true,
      },
    })

    if (!listing) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 })
    }

    // Compute priceDrop
    const history = listing.priceHistory ?? []
    let priceDrop = 0
    if (history.length > 0) {
      const maxPrevious = Math.max(...history.map((h) => h.price))
      if (maxPrevious > listing.price) {
        priceDrop = maxPrevious - listing.price
      }
    }

    const daysOnMarket = differenceInDays(new Date(), new Date(listing.firstSeen))

    return NextResponse.json({
      ...listing,
      priceDrop,
      daysOnMarket,
    })
  } catch (error) {
    console.error('GET /api/listings/[id] error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
