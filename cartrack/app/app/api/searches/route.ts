import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import type { SearchFilters } from '@/lib/types'

export async function GET() {
  try {
    const searches = await prisma.savedSearch.findMany({
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(searches)
  } catch (error) {
    console.error('GET /api/searches error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, filters } = body as { name: string; filters: SearchFilters }

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: 'name is required' },
        { status: 400 }
      )
    }

    if (!filters || typeof filters !== 'object') {
      return NextResponse.json(
        { error: 'filters must be an object' },
        { status: 400 }
      )
    }

    const savedSearch = await prisma.savedSearch.create({
      data: {
        name: name.trim(),
        filters: JSON.stringify(filters),
        lastViewed: new Date(),
        newCount: 0,
        emailAlert: false,
        desktopAlert: false,
      },
    })

    return NextResponse.json(savedSearch, { status: 201 })
  } catch (error) {
    console.error('POST /api/searches error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
